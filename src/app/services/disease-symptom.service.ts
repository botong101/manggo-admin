import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { DiseaseSymptom, DiseaseSymptomPayload } from '../models/symptom-vocabulary/disease-symptom.model';

@Injectable({ providedIn: 'root' })
export class DiseaseSymptomService {
  private base = `${environment.apiUrl}/admin/disease-symptoms`;

  constructor(private http: HttpClient) {}

  list(filters?: { disease?: number }): Observable<DiseaseSymptom[]> {
    let params = new HttpParams();
    if (filters?.disease != null) {
      params = params.set('disease', filters.disease.toString());
    }
    return this.http.get<DiseaseSymptom[]>(this.base + '/', { params }).pipe(
      map(response => response),
      catchError(error => throwError(() => error))
    );
  }

  getById(linkId: number): Observable<DiseaseSymptom> {
    return this.http.get<DiseaseSymptom>(`${this.base}/${linkId}/`).pipe(
      map(response => response),
      catchError(error => throwError(() => error))
    );
  }

  create(payload: DiseaseSymptomPayload): Observable<DiseaseSymptom> {
    return this.http.post<DiseaseSymptom>(this.base + '/', payload).pipe(
      map(response => response),
      catchError(error => throwError(() => error))
    );
  }

  update(linkId: number, payload: Partial<DiseaseSymptomPayload>): Observable<DiseaseSymptom> {
    return this.http.put<DiseaseSymptom>(`${this.base}/${linkId}/`, payload).pipe(
      map(response => response),
      catchError(error => throwError(() => error))
    );
  }

  delete(linkId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${linkId}/`).pipe(
      catchError(error => throwError(() => error))
    );
  }
}