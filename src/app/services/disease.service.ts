import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Disease, DiseasePayload } from '../models/symptom-vocabulary/disease.model';

@Injectable({ providedIn: 'root' })
export class DiseaseService {
  private base = `${environment.apiUrl}/admin/diseases`;

  constructor(private http: HttpClient) {}

  list(filters?: { plant_part?: 'leaf' | 'fruit' }): Observable<Disease[]> {
    let params = new HttpParams();
    if (filters?.plant_part) {
      params = params.set('plant_part', filters.plant_part);
    }
    return this.http.get<Disease[]>(this.base + '/', { params }).pipe(
      map(response => response),
      catchError(error => throwError(() => error))
    );
  }

  getById(diseaseId: number): Observable<Disease> {
    return this.http.get<Disease>(`${this.base}/${diseaseId}/`).pipe(
      map(response => response),
      catchError(error => throwError(() => error))
    );
  }

  create(payload: DiseasePayload): Observable<Disease> {
    return this.http.post<Disease>(this.base + '/', payload).pipe(
      map(response => response),
      catchError(error => throwError(() => error))
    );
  }

  update(diseaseId: number, payload: Partial<DiseasePayload>): Observable<Disease> {
    return this.http.put<Disease>(`${this.base}/${diseaseId}/`, payload).pipe(
      map(response => response),
      catchError(error => throwError(() => error))
    );
  }

  delete(diseaseId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${diseaseId}/`).pipe(
      catchError(error => throwError(() => error))
    );
  }
}