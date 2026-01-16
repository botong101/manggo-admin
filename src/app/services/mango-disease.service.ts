import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, catchError, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface MangoImage {
  id: number;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    date_joined: string;
  };
  image: string;
  image_url?: string; 
  original_filename: string;
  uploaded_at: string;
  upload_date?: string; 
  predicted_class: string;
  disease_classification?: string; 
  confidence_score: number;
  disease_type: 'leaf' | 'fruit' | 'unknown';
  model_used?: 'leaf' | 'fruit'; 
  model_path?: string; 
  image_size: string;
  processing_time: number;
  client_ip: string;
  is_verified?: boolean; 
  verified_date?: string | null; 
  notes?: string; 
  user_feedback?: string; 
  user_confirmed_correct?: boolean | null; 
  hasError?: boolean; 

  //gps stuff 
  latitude?: number;
  longitude?: number;
  location_accuracy?: number;
  location_consent_given?: boolean;
  location_accuracy_confirmed?: boolean; 
  location_address?: string;
  location_source?: string;
}

export interface DiseaseStats {
  total_images: number;
  healthy_images: number;
  diseased_images: number;
  leaf_images: number;
  fruit_images: number;
  diseases_breakdown: {
    [key: string]: number;
  };
  recent_uploads: number;
  monthly_uploads: number;
  verification_stats: {
    verified: number;
    unverified: number;
  };
}

export interface UserConfirmation {
  id: number;
  image_id: number;
  predicted_disease: string;
  user_feedback?: string;
  location_consent: boolean;
  latitude?: number;
  longitude?: number;
  location_accuracy?: number;
  address?: string;
  created_at?: string;  
  confirmed_at?: string; 
  confidence_score?: number;
  image_data?: {
    image_url: string;
    original_filename: string;
    disease_type: 'leaf' | 'fruit' | 'unknown';
  };
}

export interface ConfirmationStats {
  total_confirmations: number;
  correct_predictions: number;
  incorrect_predictions: number;
  accuracy_rate: number;
  disease_accuracy: {
    [key: string]: {
      correct: number;
      total: number;
      accuracy: number;
    };
  };
  confirmations_with_location: number;
  recent_confirmations: number;
}

@Injectable({
  providedIn: 'root'
})
export class MangoDiseaseService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  //get stats for dashboard
  getDiseaseStatistics(): Observable<DiseaseStats> {
    return this.http.get<{success: boolean, data: DiseaseStats}>(`${this.apiUrl}/disease-statistics/`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error('Invalid API response format');
        }),
        catchError(error => {
          return of({
            total_images: 0,
            healthy_images: 0,
            diseased_images: 0,
            leaf_images: 0,
            fruit_images: 0,
            diseases_breakdown: {},
            recent_uploads: 0,
            monthly_uploads: 0,
            verification_stats: {
              verified: 0,
              unverified: 0
            }
          });
        })
      );
  }

  getClassifiedImages(filters?: any): Observable<{
    images: MangoImage[];
    }> {
    let params = new HttpParams();
    //only add filter if it has value
    if (filters) {
      const filterKeys = Object.keys(filters);
      
      for (let i = 0; i < filterKeys.length; i++) {
        const key = filterKeys[i];
        const value = filters[key];
        
        //only add if theres a value
        if (value !== null && value !== undefined && value !== '') {
          params = params.set(key, value.toString());
        }
      }
    }

    return this.http.get<{
      success: boolean;
      data: {
        images: MangoImage[];
      };
    }>(`${this.apiUrl}/classified-images/`, { params })
      .pipe(
        map(response => {
          //check if response is good
          if (!response.success || !response.data) {
            throw new Error('Invalid API response format');
          }
          const originalImages = response.data.images;
          const transformedImages: MangoImage[] = [];
  
          for (let i = 0; i < originalImages.length; i++) {
            const image = originalImages[i];
            const transformedImage: MangoImage = {
              //copy original stuff
              id: image.id,
              user: image.user,
              image: image.image,
              original_filename: image.original_filename,
              uploaded_at: image.uploaded_at,
              predicted_class: image.predicted_class,
              confidence_score: image.confidence_score,
              disease_type: image.disease_type || 'unknown',
              image_size: image.image_size,
              processing_time: image.processing_time,
              client_ip: image.client_ip,
              
              //extra stuff
              disease_classification: image.predicted_class,
              upload_date: image.uploaded_at,
              is_verified: image.is_verified || false,
              notes: image.notes || '',
              
              //maybe has these
              model_used: image.model_used,
              model_path: image.model_path,
              verified_date: image.verified_date,
              user_feedback: image.user_feedback,
              user_confirmed_correct: image.user_confirmed_correct,
              hasError: image.hasError,
              latitude: image.latitude,
              longitude: image.longitude,
              location_accuracy: image.location_accuracy,
              location_consent_given: image.location_consent_given,
              location_accuracy_confirmed: image.location_accuracy_confirmed,
              location_address: image.location_address,
              location_source: image.location_source
            };
            
            //add to list
            transformedImages.push(transformedImage);
          }
          return {
            images: transformedImages,
          };
        }),
        catchError(error => {
          //something went wrong
          console.error('Error fetching classified images:', error);
          
          return of({
            images: [],
          });
        })
      );
  }

  //update image verification
  updateImageVerification(imageId: number, isVerified: boolean, notes?: string): Observable<ApiResponse<MangoImage>> {
    const updateData = {
      is_verified: isVerified,
      notes: notes || ''
    };

    return this.http.put<ApiResponse<MangoImage>>(`${this.apiUrl}/classified-images/${imageId}/`, updateData)
      .pipe(
        catchError(error => {
          throw error;
        })
      );
  }

  //delete
  deleteImage(imageId: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/classified-images/${imageId}/`)
      .pipe(
        catchError(error => {
          throw error;
        })
      );
  }


  uploadAndClassifyImage(formData: FormData): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/classify-image/`, formData)
      .pipe(
        catchError(error => {
          throw error;
        })
      );
  }

  //update multiple images at once
  bulkUpdateImages(imageIds: number[], updates: Partial<MangoImage>): Observable<ApiResponse<any>> {
    const bulkData = {
      image_ids: imageIds,
      updates: updates
    };

    return this.http.post<any>(`${this.apiUrl}/classified-images/bulk-update/`, bulkData)
      .pipe(
        catchError(error => {
          throw error;
        })
      );
  }



  //image info
  getImageDetails(imageId: number): Observable<ApiResponse<MangoImage>> {
    return this.http.get<ApiResponse<MangoImage>>(`${this.apiUrl}/classified-images/${imageId}/`)
      .pipe(
        catchError(error => {
          throw error;
        })
      );
  }

  //get prediction data
  getImagePredictionDetails(imageId: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/classified-images/${imageId}/prediction-details/`)
      .pipe(
      map(resp => {
        const wrapper = resp?.data?.prediction_data ?? resp?.data ?? resp;
        const pd = wrapper?.data ?? wrapper ?? {};

        const primary = pd?.primary_prediction ?? pd?.primary ?? null;
        let top3 = Array.isArray(pd?.top_3_predictions) ? pd.top_3_predictions : (Array.isArray(pd?.top_3) ? pd.top_3 : []);

        //convert to percent
        const toPercent = (raw: any): number => {
          if (raw === null || raw === undefined) return 0;
          if (typeof raw === 'string') {
            const s = raw.trim();
            const withoutPercent = s.endsWith('%') ? s.slice(0, -1) : s;
            const n = parseFloat(withoutPercent.replace(/[^0-9.\-]/g, ''));
            return isNaN(n) ? 0 : n;
          }
          if (typeof raw === 'number') {
            return raw <= 1 ? raw * 100 : raw;
          }
          return 0;
        };

        //top 3 diseases
        if (!Array.isArray(top3) || top3.length === 0) {
          if (primary) top3 = [primary];
          else top3 = [];
        }

        //make sure primary is first
        if (primary) {
          top3 = [primary, ...top3.filter((x:any) => x?.disease !== primary.disease)].slice(0,3);
        } else {
          top3 = top3.slice(0,3);
        }

        const normalize = (p:any) => {
          const score = toPercent(p?.confidence_score ?? p?.confidence ?? p?.confidence_formatted ?? p?.confidence_formatted);
          return {
            disease: p?.disease ?? p?.label ?? 'Unknown',
            confidence_score: Number(score),
            confidence_level: p?.confidence_level ?? (score > 80 ? 'High' : score > 60 ? 'Medium' : 'Low'),
            treatment: p?.treatment ?? '',
            detection_type: p?.detection_type ?? ''
          };
        };

        const normalizedPrimary = normalize(primary ?? top3[0] ?? {});
        const normalizedTop3 = top3.map(normalize).slice(0,3);

        return {
          success: wrapper?.success ?? true,
          message: wrapper?.message ?? '',
          data: {
            primary_prediction: normalizedPrimary,
            top_3_predictions: normalizedTop3,
            prediction_summary: pd?.prediction_summary ?? {},
            saved_image_id: pd?.saved_image_id ?? null,
            model_used: pd?.model_used ?? null,
            model_path: pd?.model_path ?? null,
            debug_info: pd?.debug_info ?? {}
          },
          timestamp: wrapper?.timestamp ?? new Date().toISOString()
        } as ApiResponse<any>;
      })
    );
  }

  //user feedback stuff

  //get confirmations with filters
  getUserConfirmations(params?: {
    disease?: string;
    page?: number;
    page_size?: number;
    start_date?: string;
    end_date?: string;
    image_id?: number;
  }): Observable<ApiResponse<{
    results: UserConfirmation[];
    count: number;
    next: string | null;
    previous: string | null;
  }>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        const value = (params as any)[key];
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/user-confirmations/`, { params: httpParams })
      .pipe(
        catchError(error => {
          throw error;
        })
      );
  }

  //get confirmation for specific image
  getUserConfirmationForImage(imageId: number): Observable<UserConfirmation | null> {
    let httpParams = new HttpParams().set('image_id', imageId.toString()).set('page_size', '1');
    const url = `${this.apiUrl}/user-confirmations/`;

    return this.http.get<ApiResponse<any>>(url, { params: httpParams })
      .pipe(
        map((response: any) => {
          if (!response || !response.success || !response.data) {
            return null;
          }

          
          const rawList =
            response.data?.confirmations ||
            response.data?.results ||
            (Array.isArray(response.data) ? response.data : response.data);

          const list = Array.isArray(rawList) ? rawList : (rawList?.results || rawList?.confirmations || []);
          
          const conf = list.find((c: any) =>
            (c.image && (c.image.id === imageId || c.image_id === imageId)) ||
            c.image_id === imageId
          );

          if (!conf) {
            return null;
          }

          const normalized: UserConfirmation = {
            id: conf.id ?? null,
            image_id: conf.image?.id ?? conf.image_id ?? imageId,
            predicted_disease: conf.predicted_disease ?? conf.prediction ?? '',
            user_feedback: conf.user_feedback ?? conf.feedback ?? '',
            location_consent: !!(conf.location?.consent_given ?? conf.location_consent_given ?? conf.location_consent),
            latitude: conf.location?.latitude ?? conf.latitude ?? undefined,
            longitude: conf.location?.longitude ?? conf.longitude ?? undefined,
            location_accuracy: conf.location?.accuracy ?? conf.location_accuracy ?? undefined,
            address: conf.location?.address ?? conf.location_address ?? conf.address ?? undefined,
            created_at: conf.created_at ?? conf.confirmed_at ?? undefined,
            confirmed_at: conf.confirmed_at ?? conf.created_at ?? undefined,
            confidence_score: conf.confidence_score ?? conf.confidence ?? undefined,
            image_data: {
              image_url: conf.image?.image_url ?? conf.image?.image ?? '',
              original_filename: conf.image?.original_filename ?? '',
              disease_type: conf.image?.disease_type ?? 'unknown'
            },
          };

          //gps accuracy
          (normalized as any).location_accuracy = conf.location?.accuracy ?? conf.location_accuracy ?? undefined;

          return normalized;
        }),
        catchError(error => {
          return of(null);
        })
      );
  }

  //get confirmation stats
  getConfirmationStatistics(): Observable<ApiResponse<ConfirmationStats>> {
    return this.http.get<ApiResponse<ConfirmationStats>>(`${this.apiUrl}/confirmation-statistics/`)
      .pipe(
        catchError(error => {
          throw error;
        })
      );
  }

  
  exportConfirmations(params?: {
    disease?: string;
    start_date?: string;
    end_date?: string;
  }): Observable<Blob> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        const value = (params as any)[key];
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get(`${this.apiUrl}/export-confirmations/`, {
      params: httpParams,
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        throw error;
      })
    );
  }

  //group by disease
  getConfirmationsByDisease(): Observable<ApiResponse<{
    [disease: string]: {
      correct: UserConfirmation[];
      incorrect: UserConfirmation[];
      total: number;
      accuracy: number;
    };
  }>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/confirmations-by-disease/`)
      .pipe(
        catchError(error => {
          throw error;
        })
      );
  }



  //get images with optional filtering
  getImages(params?: any): Observable<ApiResponse<MangoImage[]>> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        const value = params[key];
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<ApiResponse<MangoImage[]>>(`${this.apiUrl}/classified-images/`, { params: httpParams })
      .pipe(
        catchError(error => {
          throw error;
        })
      );
  }

  //mark image as verified
  verifyImage(imageId: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/classified-images/${imageId}/verify/`, {})
      .pipe(
        catchError(error => {
          throw error;
        })
      );
  }

  //download images as zip
  downloadImagesZip(imageIds: number[]): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/download-images-zip/`, 
      { image_ids: imageIds },
      { responseType: 'blob' }
    ).pipe(
      catchError(error => {
        throw error;
      })
    );
  }

  //download one image
  downloadImage(imageId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/download-image/${imageId}/`, {
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        throw error;
      })
    );
  }

  //download all images from a user
  downloadUserImages(userId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/download-user-images/${userId}/`, {
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        throw error;
      })
    );
  }

  //download by disease
  downloadImagesByDisease(diseaseType: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/download-disease-images/`, {
      params: { disease_type: diseaseType },
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        throw error;
      })
    );
  }

  //download verified or not
  downloadImagesByVerification(isVerified: boolean): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/download-verification-images/`, {
      params: { is_verified: isVerified.toString() },
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        throw error;
      })
    );
  }
}