import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Symptom, SymptomPayload } from '../models/symptom-vocabulary/symptom.model';

@Injectable({ providedIn: 'root' })
export class SymptomService {
  private base = `${environment.apiUrl}/admin/symptoms`;

  constructor(private http: HttpClient) {}

  list(filters?: { plant_part?: 'leaf' | 'fruit' }): Observable<Symptom[]> {
    let params = new HttpParams();
    if (filters?.plant_part) {
      params = params.set('plant_part', filters.plant_part);
    }
    return this.http.get<Symptom[]>(this.base + '/', { params }).pipe(
      map(response => response),
      catchError(error => throwError(() => error))
    );
  }

  getById(symptomId: number): Observable<Symptom> {
    return this.http.get<Symptom>(`${this.base}/${symptomId}/`).pipe(
      map(response => response),
      catchError(error => throwError(() => error))
    );
  }

  create(payload: SymptomPayload): Observable<Symptom> {
    return this.http.post<Symptom>(this.base + '/', payload).pipe(
      map(response => response),
      catchError(error => throwError(() => error))
    );
  }

  update(symptomId: number, payload: Partial<SymptomPayload>): Observable<Symptom> {
    return this.http.put<Symptom>(`${this.base}/${symptomId}/`, payload).pipe(
      map(response => response),
      catchError(error => throwError(() => error))
    );
  }

  delete(symptomId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${symptomId}/`).pipe(
      catchError(error => throwError(() => error))
    );
  }
}