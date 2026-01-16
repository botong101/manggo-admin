import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  access: string;
  refresh: string;
  user: {
    id: number;
    username: string;
    is_superuser: boolean;
    email: string;
  };
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  private currentUserSubject = new BehaviorSubject<any>(this.getCurrentUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  login(credentials: LoginRequest): Observable<LoginResponse> {
    const loginUrl = `${this.apiUrl}/auth/login/`;
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.post<LoginResponse>(loginUrl, credentials, { headers })
      .pipe(
        tap(response => {
          if (response.success && response.access) {
            this.setToken(response.access);
            this.setRefreshToken(response.refresh);
            this.setCurrentUser(response.user);
            this.isAuthenticatedSubject.next(true);
            this.currentUserSubject.next(response.user);
          }
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Login error:', error);
          return throwError(() => error);
        })
      );
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('current_user');
    }
    this.isAuthenticatedSubject.next(false);
    this.currentUserSubject.next(null);
  }

  getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('access_token');
    }
    return null;
  }

  getCurrentUser(): any {
    if (isPlatformBrowser(this.platformId)) {
      const userStr = localStorage.getItem('current_user');
      return userStr ? JSON.parse(userStr) : null;
    }
    return null;
  }

  private setToken(token: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('access_token', token);
    }
  }

  private setCurrentUser(user: any): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('current_user', JSON.stringify(user));
    }
  }

  private setRefreshToken(token: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('refresh_token', token);
    }
  }

  isLoggedIn(): boolean {
    return this.hasToken();
  }

  //refresh auth state
  refreshAuthState(): void {
    const isAuth = this.hasToken();
    const user = this.getCurrentUser();
    this.isAuthenticatedSubject.next(isAuth);
    this.currentUserSubject.next(user);
  }

  private hasToken(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('access_token');
      return !!token;
    }
    return false;
  }
}