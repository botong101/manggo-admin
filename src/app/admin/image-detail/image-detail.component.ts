import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { MangoDiseaseService, MangoImage, ApiResponse, UserConfirmation } from '../../services/mango-disease.service';
import { environment } from '../../../environments/environment';

export interface PredictionData {
  success: boolean;
  message: string;
  data: {
    primary_prediction: {
      disease: string;
      confidence: string;
      confidence_score: number;
      confidence_level: string;
      treatment: string;
      detection_type: string;
    };
    top_3_predictions: Array<{
      disease: string;
      confidence: string;
      confidence_score: number;
      confidence_level: string;
      treatment: string;
      detection_type: string;
    }>;
    prediction_summary: {
      most_likely_disease: string;
      confidence_level: string;
      total_diseases_checked: number;
    };
    saved_image_id: number;
    model_used: string;
    model_path: string;
    debug_info: {
      model_loaded: boolean;
      image_size: string;
      processed_size: string;
    };
  };
  timestamp: string;
}

export interface ImageDetailData extends MangoImage {
  prediction_data?: PredictionData;
  verified_date?: string | null;
  filename?: string;
  image_type?: string;
  disease_detected?: string;
  confidence?: number;
  user_feedback?: string; //user feedback field
  location_accuracy_confirmed?: boolean; //location accuracy flag
}

@Component({
  selector: 'app-image-detail',
  templateUrl: './image-detail.component.html',
  styleUrls: ['./image-detail.component.css'],
  standalone: false
})
export class ImageDetailComponent implements OnInit {
  imageId: number = 0;
  imageData: ImageDetailData | null = null;
  predictionData: ApiResponse<any> | null = null;
  userConfirmation: UserConfirmation | null = null;
  loading = true;
  error: string | null = null;
  
  //ui stuff
  activeTab: 'overview' | 'prediction' | 'technical' | 'history' | 'feedback' = 'overview';
  showFullImage = false;
  updating = false;
  imageError = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private mangoDiseaseService: MangoDiseaseService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.imageId = +params['id'];
      if (this.imageId) {
        this.loadImageDetails();
      }
    });
  }

  async loadImageDetails() {
    try {
      this.loading = true;
      this.error = null;

      //get image data
      const imageResponse = await firstValueFrom(this.mangoDiseaseService.getImageDetails(this.imageId));
      if (imageResponse && imageResponse.success) {
        this.imageData = imageResponse.data;
      }

      //get predictions
      const predictionResponse = await firstValueFrom(this.mangoDiseaseService.getImagePredictionDetails(this.imageId));
      if (predictionResponse && predictionResponse.success) {
        this.predictionData = predictionResponse;
      }

      //get user confirmation
      try {
        this.userConfirmation = await firstValueFrom(this.mangoDiseaseService.getUserConfirmationForImage(this.imageId)) || null;
      } catch (confirmationError) {
        //no confirmation is ok
      }

      this.loading = false;
    } catch (error) {
      this.error = 'Failed to load image details. Please try again.';
      this.loading = false;
    }
  }

  setActiveTab(tab: 'overview' | 'prediction' | 'technical' | 'history' | 'feedback') {
    this.activeTab = tab;
  }

  toggleFullImage() {
    this.showFullImage = !this.showFullImage;
  }

  async updateVerificationStatus(isVerified: boolean) {
    if (!this.imageData) return;

    try {
      this.updating = true;
      const response = await firstValueFrom(this.mangoDiseaseService.updateImageVerification(this.imageData.id, isVerified));
      
      if (response && response.success) {
        this.imageData.is_verified = isVerified;
        this.imageData.verified_date = isVerified ? new Date().toISOString() : null;
      }
    } catch (error) {
      console.error('Error updating verification:', error);
    } finally {
      this.updating = false;
    }
  }

  async deleteImage() {
    if (!this.imageData) return;

    if (confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      try {
        this.updating = true;
        const response = await firstValueFrom(this.mangoDiseaseService.deleteImage(this.imageData.id));
        
        if (response && response.success) {
          this.location.back();
        }
      } catch (error) {
        console.error('Error deleting image:', error);
        this.error = 'Failed to delete image. Please try again.';
      } finally {
        this.updating = false;
      }
    }
  }

  navigateBack() {
    this.location.back();
  }

  getConfidenceColor(confidence: number): string {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }

  getConfidenceBgColor(confidence: number): string {
    if (confidence >= 80) return 'bg-green-100';
    if (confidence >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  }

  getImageUrl(): string {
    if (!this.imageData) return '';
    
    const baseUrl = environment.apiUrl.replace('/api', '');
    const originalUrl = this.imageData.image_url || this.imageData.image;
    
    if (!originalUrl) {
      return `${baseUrl}/api/media/mango_images/${this.imageData.original_filename}`;
    }
    
    if (originalUrl.startsWith('http')) {
      return originalUrl;
    }
    
    //custom media endpoint
    let filePath = '';
    if (originalUrl.startsWith('/media/')) {
      filePath = originalUrl.substring(7);
    } else if (originalUrl.startsWith('media/')) {
      filePath = originalUrl.substring(6);
    } else if (originalUrl.includes('mango_images/')) {
      const mangoIndex = originalUrl.indexOf('mango_images/');
      filePath = originalUrl.substring(mangoIndex);
    } else {
      filePath = originalUrl.startsWith('/') ? originalUrl.substring(1) : originalUrl;
    }
    
    return `${baseUrl}/api/media/${filePath}`;
  }

  formatDateTime(dateString: string | null | undefined): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  }

  getGPSQuality(accuracy: number): string {
    if (accuracy <= 10) return 'Excellent';
    if (accuracy <= 50) return 'Good';
    return 'Poor';
  }

  onImageError(event: any) {
    this.imageError = true;
  }

  onImageLoad(event: any) {
    this.imageError = false;
  }

  getDiseaseType(): 'leaf' | 'fruit' | 'unknown' {
    const image = this.imageData;
    if (!image) return 'unknown';
    
    //check disease_type from api
    if (image.disease_type && image.disease_type !== 'unknown') {
      return image.disease_type;
    }
    
    //fallback to model_used
    if (image.model_used) {
      return image.model_used;
    }
    
    return 'unknown';
  }

  getFormattedModelName(): string {
    // First, try to get the actual model path from the API response
    const modelPath = this.predictionData?.data?.model_path;
    
    if (modelPath) {
      // Extract model name from the file path
      const fileName = modelPath.split('/').pop()?.split('\\').pop(); //handle both / and \\ paths
      
      if (fileName) {
        // Parse specific model file names (order matters - more specific patterns first)
        if (fileName.includes('leaf-mobilenetv2')) {
          return 'Leaf MobileNetV2';
        } else if (fileName.includes('fruit-efficientnetb0')) {
          return 'Fruit EfficientNetB0';
        } else if (fileName.includes('leaf-efficientnetb0')) {
          return 'Leaf EfficientNetB0';
        } else if (fileName.includes('leaf-resnet101')) {
          return 'Leaf ResNet101';
        } else if (fileName.includes('fruit-resnet101')) {
          return 'Fruit ResNet101';
        } else if (fileName.includes('resnet101')) {
          return 'ResNet101';
        } else if (fileName.includes('efficientnetb0')) {
          return 'EfficientNetB0';
        } else if (fileName.includes('mobilenetv2')) {
          return 'MobileNetV2';
        } else {
          // Remove .keras extension and format nicely
          const modelName = fileName.replace('.keras', '').replace('.h5', '');
          return modelName.split('-').map((part: string) => 
            part.charAt(0).toUpperCase() + part.slice(1)
          ).join(' ');
        }
      }
    }
    
    // Fallback to the disease type approach if no model path is available
    const diseaseType = this.getDiseaseType();
    
    switch (diseaseType) {
      case 'leaf':
        return 'Leaf MobileNetV2';
      case 'fruit':
        return 'Fruit EfficientNetB0';
      default:
        return 'EfficientNetB0'; // Default fallback
    }
  }

  getModelFilePath(): string {
    return this.predictionData?.data?.model_path || 'Model path not available';
  }
}
