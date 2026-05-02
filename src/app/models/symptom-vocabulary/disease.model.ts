export interface Disease {
  id: number;
  name: string;
  plant_part: 'leaf' | 'fruit';
  is_in_classifier: boolean;
  description: string;
  treatment: string;
}

export interface DiseasePayload {
  name: string;
  plant_part: 'leaf' | 'fruit';
  is_in_classifier?: boolean;
  description?: string;
  treatment?: string;
}