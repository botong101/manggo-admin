export interface DiseaseSymptom {
  id: number;
  disease: number;
  disease_name: string;
  symptom: number;
  symptom_key: string;
  display_label: string;
  display_order: number;
}

export interface DiseaseSymptomPayload {
  disease: number;
  symptom: number;
  display_label?: string;
  display_order?: number;
}