import { Component, OnInit } from '@angular/core';
import { MangoDiseaseService, DiseaseStats, MangoImage } from '../../services/mango-disease.service';
import { Router } from '@angular/router';

interface DiseaseCategory {
  id: string;
  name: string;
  type: 'leaf' | 'fruit';
  description: string;
  imageCount: number;
  severity: 'low' | 'medium' | 'high';
  color: string;
  lastDetected?: string;
  percentage?: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: false
})
export class DashboardComponent implements OnInit {
  
  // Current date for display
  currentDate = new Date().toLocaleDateString();
  
  // Loading states
  loading = true;
  error: string | null = null;
  
  // Real data from backend
  stats: DiseaseStats | null = null;
  recentImages: MangoImage[] = [];
  
  // Statistics
  totalImages = 0;
  healthyImages = 0;
  diseasedImages = 0;

  constructor(
    private mangoDiseaseService: MangoDiseaseService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  async loadDashboardData() {
    try {
      this.loading = true;
      this.error = null;

      console.log('Loading dashboard data...');

      // Skip connection test - load data directly

      // Load statistics
      const stats = await this.mangoDiseaseService.getDiseaseStatistics().toPromise();
      console.log('Statistics loaded:', stats);
      
      if (stats) {
        this.stats = stats;
        this.updateStatistics(stats);
      }

      // Load recent images
      const recentImagesResponse = await this.mangoDiseaseService.getClassifiedImages(1, 10).toPromise();
      console.log('Recent images loaded:', recentImagesResponse);
      
      if (recentImagesResponse) {
        this.recentImages = recentImagesResponse.images; // Fixed: use .images instead of .results
      }

      // If we got here, everything loaded successfully
      this.loading = false;

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.error = 'Failed to load dashboard data. Please try again.';
      this.loading = false;
      
      // Load fallback static data
      this.loadStaticData();
    }
  }

  private updateStatistics(stats: DiseaseStats) {
    this.totalImages = stats.total_images;
    this.healthyImages = stats.healthy_images;
    this.diseasedImages = stats.diseased_images;
  }



  private loadStaticData() {
    // Static fallback data
    this.totalImages = 0;
    this.healthyImages = 0;
    this.diseasedImages = 0;
    
    console.log('Using static fallback data');
  }



    // Navigation methods
  navigateToUploadImages() {
    this.router.navigate(['/admin/upload-images']);
  }
  
  navigateToImageGallery(filter?: string) {
    if (filter) {
      this.router.navigate(['/admin/verified-images'], { queryParams: { filter } });
    } else {
      this.router.navigate(['/admin/verified-images']);
    }
  }
  
  navigateToUserManagement() {
    this.router.navigate(['/admin/user-management']);
  }
  
  navigateToModelSettings() {
    // Navigate to model settings when available
    console.log('Navigate to model settings');
  }

  async exportDataset() {
    try {
      // Export functionality moved to admin dashboard views
      console.log('Export dataset functionality will be implemented in backend');
      // TODO: Implement direct backend call for dataset export
      alert('Export functionality will be available in a future update');
    } catch (error) {
      console.error('Error exporting dataset:', error);
      alert('Failed to export dataset. Please try again.');
    }
  }


}