import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { SymptomAlias, SymptomAliasPayload } from '../models/symptom-vocabulary/symptom-alias.model';

@Injectable({ providedIn: 'root' })
export class SymptomAliasService {
  private base = `${environment.apiUrl}/admin/aliases`;

  constructor(private http: HttpClient) {}

  list(filters?: { canonical?: number }): Observable<SymptomAlias[]> {
    let params = new HttpParams();
    if (filters?.canonical != null) {
      params = params.set('canonical', filters.canonical.toString());
    }
    return this.http.get<SymptomAlias[]>(this.base + '/', { params }).pipe(
      map(response => response),
      catchError(error => throwError(() => error))
    );
  }

  getById(aliasId: number): Observable<SymptomAlias> {
    return this.http.get<SymptomAlias>(`${this.base}/${aliasId}/`).pipe(
      map(response => response),
      catchError(error => throwError(() => error))
    );
  }

  create(payload: SymptomAliasPayload): Observable<SymptomAlias> {
    return this.http.post<SymptomAlias>(this.base + '/', payload).pipe(
      map(response => response),
      catchError(error => throwError(() => error))
    );
  }

  update(aliasId: number, payload: Partial<SymptomAliasPayload>): Observable<SymptomAlias> {
    return this.http.put<SymptomAlias>(`${this.base}/${aliasId}/`, payload).pipe(
      map(response => response),
      catchError(error => throwError(() => error))
    );
  }

  delete(aliasId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${aliasId}/`).pipe(
      catchError(error => throwError(() => error))
    );
  }
}