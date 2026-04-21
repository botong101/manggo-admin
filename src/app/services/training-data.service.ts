import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
   TrainingApiResponse,
   TrainingDataDetail,
   TrainingDataPatchRequest,
   TrainingDataPatchResponse,
   TrainingDataSummary,
   TrainingBulkApproveRequest,
   TrainingBulkApproveResponse,
 } from './training-data.interfaces';

 @Injectable({ providedIn: 'root' })
 export class TrainingDataService {
   private readonly api = environment.apiUrl;

   constructor(private http: HttpClient) {}

   /** GET /api/training-data/<pk>/ */
   getTrainingDetail(id: number): Observable<TrainingApiResponse<TrainingDataDetail>> {
     return this.http.get<TrainingApiResponse<TrainingDataDetail>>(
       `${this.api}/training-data/${id}/`
     );
   }

   /** PATCH /api/training-data/<pk>/ */
   patchTrainingDetail(
     id: number,
     payload: TrainingDataPatchRequest
   ): Observable<TrainingDataPatchResponse> {
     return this.http.patch<TrainingDataPatchResponse>(
       `${this.api}/training-data/${id}/`,
       payload
     );
   }

   /** GET /api/training-data/summary/ */
   getSummary(): Observable<TrainingApiResponse<TrainingDataSummary>> {
     return this.http.get<TrainingApiResponse<TrainingDataSummary>>(
       `${this.api}/training-data/summary/`
     );
   }

   /** POST /api/training-data/bulk-approve/ */
   bulkApprove(
     payload: TrainingBulkApproveRequest
   ): Observable<TrainingBulkApproveResponse> {
     return this.http.post<TrainingBulkApproveResponse>(
       `${this.api}/training-data/bulk-approve/`,
       payload
     );
   }
 }