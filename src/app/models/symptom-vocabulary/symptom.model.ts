export interface Symptom {
  id: number;
  key: string;
  plant_part: 'leaf' | 'fruit';
  vector_index: number | null;
  is_in_vocabulary: boolean;
  created_at: string;
}

export interface SymptomPayload {
  key: string;
  plant_part: 'leaf' | 'fruit';
  vector_index?: number | null;
  is_in_vocabulary?: boolean;
}