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
  image_url?: string; // Add this for template compatibility
  original_filename: string;
  uploaded_at: string;
  upload_date?: string; // Add this for template compatibility
  predicted_class: string;
  disease_classification?: string; // Add this for template compatibility
  confidence_score: number;
  disease_type: 'leaf' | 'fruit' | 'unknown';
  model_used?: 'leaf' | 'fruit'; // Add this for the backend's model_used field
  model_path?: string; // Add this for the actual model file path
  image_size: string;
  processing_time: number;
  client_ip: string;
  is_verified?: boolean; // Add this for template compatibility
  verified_date?: string | null; // Add this for template compatibility
  notes?: string; // Add this for template compatibility
  user_feedback?: string; // Add this for user feedback from analysis
  user_confirmed_correct?: boolean | null; // Add this for user confirmation during analysis
  hasError?: boolean; // Add this for error state tracking
  // Location data from EXIF
  latitude?: number;
  longitude?: number;
  location_accuracy?: number;
  location_consent_given?: boolean;
  location_accuracy_confirmed?: boolean; // Whether user confirmed location as accurate
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
    [key: string]: number; // Your API returns numbers, not objects
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
  is_correct: boolean;
  user_feedback?: string;
  location_consent: boolean;
  latitude?: number;
  longitude?: number;
  location_accuracy?: number;
  address?: string;
  created_at?: string;  // For compatibility
  confirmed_at?: string; // Backend returns this
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

  // Get disease statistics - handle your API's success/data wrapper
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
          // Return fallback data
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

  // Get classified images - handle your API's success/data wrapper
  getClassifiedImages(page: number = 1, pageSize: number = 5, filters?: any): Observable<{
    images: MangoImage[];
    pagination: {
      page: number;
      page_size: number;
      total_count: number;
      total_pages: number;
      has_next: boolean;
      has_previous: boolean;
    };
  }> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());

    // Add filters if provided
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
          params = params.set(key, filters[key].toString());
        }
      });
    }

    return this.http.get<{
      success: boolean;
      data: {
        images: MangoImage[];
        pagination: {
          page: number;
          page_size: number;
          total_count: number;
          total_pages: number;
          has_next: boolean;
          has_previous: boolean;
        };
      };
    }>(`${this.apiUrl}/classified-images/`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            // Transform images to add missing properties for template compatibility
            const transformedImages = response.data.images.map(image => {
              const originalImageUrl = image.image_url || image.image;
              let imageUrl = originalImageUrl;
              
              // Use the new custom media serving endpoint for better reliability
              if (imageUrl && !imageUrl.startsWith('http')) {
                const baseUrl = this.apiUrl.replace(/\/api$/, '');
                let filePath = '';
                
                if (imageUrl.startsWith('/media/')) {
                  filePath = imageUrl.substring(7); // Remove '/media/'
                } else if (imageUrl.startsWith('media/')) {
                  filePath = imageUrl.substring(6); // Remove 'media/'
                } else if (imageUrl.includes('mango_images/')) {
                  const mangoIndex = imageUrl.indexOf('mango_images/');
                  filePath = imageUrl.substring(mangoIndex);
                } else {
                  filePath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
                }
                
                imageUrl = `${baseUrl}/api/media/${filePath}`;
              }
              
              return {
                ...image,
                image_url: imageUrl,
                disease_classification: image.predicted_class,
                upload_date: image.uploaded_at,
                is_verified: image.is_verified || false,
                notes: image.notes || '',
                disease_type: image.disease_type || 'unknown'
              };
            });

            return {
              images: transformedImages,
              pagination: response.data.pagination
            };
          }
          throw new Error('Invalid API response format');
        }),
        catchError(error => {
          return of({
            images: [],
            pagination: {
              page: 1,
              page_size: 20,
              total_count: 0,
              total_pages: 0,
              has_next: false,
              has_previous: false
            }
          });
        })
      );
  }

  // Update image verification status
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

  // Delete image
  deleteImage(imageId: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/classified-images/${imageId}/`)
      .pipe(
        catchError(error => {
          throw error;
        })
      );
  }

  // Upload and classify image with location data
  uploadAndClassifyImage(formData: FormData): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/classify-image/`, formData)
      .pipe(
        catchError(error => {
          throw error;
        })
      );
  }

  // Bulk update images
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



  // Get detailed image information
  getImageDetails(imageId: number): Observable<ApiResponse<MangoImage>> {
    return this.http.get<ApiResponse<MangoImage>>(`${this.apiUrl}/classified-images/${imageId}/`)
      .pipe(
        catchError(error => {
          throw error;
        })
      );
  }

  // Get detailed prediction information for an image
  getImagePredictionDetails(imageId: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/classified-images/${imageId}/prediction-details/`)
      .pipe(
      map(resp => {
        const wrapper = resp?.data?.prediction_data ?? resp?.data ?? resp;
        const pd = wrapper?.data ?? wrapper ?? {};

        const primary = pd?.primary_prediction ?? pd?.primary ?? null;
        let top3 = Array.isArray(pd?.top_3_predictions) ? pd.top_3_predictions : (Array.isArray(pd?.top_3) ? pd.top_3 : []);

        // helper to convert all confidence shapes to numeric percentage
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

        // ensure top3 exists
        if (!Array.isArray(top3) || top3.length === 0) {
          if (primary) top3 = [primary];
          else top3 = [];
        }

        // ensure primary is first and unique
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

  // User Confirmation Methods

  // Get all user confirmations with filtering
  getUserConfirmations(params?: {
    disease?: string;
    is_correct?: boolean;
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

  // Get user confirmation for a specific image
  getUserConfirmationForImage(imageId: number): Observable<UserConfirmation | null> {
    let httpParams = new HttpParams().set('image_id', imageId.toString()).set('page_size', '1');
    const url = `${this.apiUrl}/user-confirmations/`;

    return this.http.get<ApiResponse<any>>(url, { params: httpParams })
      .pipe(
        map((response: any) => {
          if (!response || !response.success || !response.data) {
            return null;
          }

          // backend may return data.confirmations or data.results or data
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
            is_correct: conf.is_correct ?? null,
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

          // optional: confidence mapping
          (normalized as any).location_accuracy = conf.location?.accuracy ?? conf.location_accuracy ?? undefined;

          return normalized;
        }),
        catchError(error => {
          return of(null);
        })
      );
  }

  // Get user confirmation statistics
  getConfirmationStatistics(): Observable<ApiResponse<ConfirmationStats>> {
    return this.http.get<ApiResponse<ConfirmationStats>>(`${this.apiUrl}/confirmation-statistics/`)
      .pipe(
        catchError(error => {
          throw error;
        })
      );
  }

  // Export user confirmations to CSV
  exportConfirmations(params?: {
    disease?: string;
    is_correct?: boolean;
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

  // Get confirmations by disease (grouped)
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

  // Additional methods for legacy components

  // Get images with optional filtering
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

  // Verify an image
  verifyImage(imageId: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/classified-images/${imageId}/verify/`, {})
      .pipe(
        catchError(error => {
          throw error;
        })
      );
  }

  // Download images as ZIP
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

  // Download single image
  downloadImage(imageId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/download-image/${imageId}/`, {
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        throw error;
      })
    );
  }

  // Download user images
  downloadUserImages(userId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/download-user-images/${userId}/`, {
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        throw error;
      })
    );
  }

  // Download images by disease type
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

  // Download verified/unverified images
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