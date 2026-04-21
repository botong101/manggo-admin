 // ─── Training Data Interfaces ────────────────────────────────────────────────
 // Mirror: mangosense/models.py → MangoImage (training fields only)
 // Mirror: mangosense/views/admin_dashboard_views.py → Option B endpoints

 /** Payload returned by GET /api/training-data/<pk>/ */
 export interface TrainingDataDetail {
   id: number;
   original_filename: string;
   predicted_class: string;
   disease_type: 'leaf' | 'fruit';
   disease_classification: string;
   is_verified: boolean;
   training_ready: boolean;
   training_notes: string;
   selected_symptoms: string[] | null;   // JSONField — can be null
   uploaded_at: string;                  // ISO 8601
 }

 /** Request body for PATCH /api/training-data/<pk>/ */
 export interface TrainingDataPatchRequest {
   training_ready?: boolean;
   training_notes?: string;
   disease_classification?: string;      // only allowed writable fields
 }

 /** Response body for PATCH /api/training-data/<pk>/ */
 export interface TrainingDataPatchResponse {
   success: boolean;
   message: string;
   data: {
     id: number;
     training_ready: boolean;
     training_notes: string;
     disease_classification: string;
   };
 }

 /** One row in summary breakdown */
 export interface TrainingClassBreakdown {
   disease_classification: string;
   disease_type: 'leaf' | 'fruit';
   count: number;
 }

 /** Response body for GET /api/training-data/summary/ */
 export interface TrainingDataSummary {
   total_training_ready: number;
   total_verified: number;
   verified_not_yet_approved: number;
   breakdown_by_class: TrainingClassBreakdown[];
 }

 /** Request body for POST /api/training-data/bulk-approve/ */
 export interface TrainingBulkApproveRequest {
   image_ids: number[];
   training_ready: boolean;
   training_notes?: string;
 }

 /** Response body for POST /api/training-data/bulk-approve/ */
 export interface TrainingBulkApproveResponse {
   success: boolean;
   message: string;
   updated_count: number;
   training_ready: boolean;
 }

 /** Generic API wrapper shape used throughout this app */
 export interface TrainingApiResponse<T> {
   success: boolean;
   data?: T;
   error?: string;
 }