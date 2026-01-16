import { MangoImage } from '../../services/mango-disease.service';

export interface VerifiedDiseaseFolder {
  disease: string;
  count: number;
  images: MangoImage[];
  expanded: boolean;
  diseaseType: 'leaf' | 'fruit' | 'unknown';
  downloading: boolean;
  verificationStatus?: 'all' | 'verified' | 'unverified' | 'unknown';
}

export interface MainFolder {
  name: string;
  count: number;
  expanded: boolean;
  subFolders: VerifiedDiseaseFolder[];
  originalSubFolders: VerifiedDiseaseFolder[]; //this original unfiltered image data
  type: 'all' | 'verified' | 'unverified' | 'unknown';
}