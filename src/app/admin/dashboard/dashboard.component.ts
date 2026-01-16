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
  
  //today's date
  currentDate = new Date().toLocaleDateString();
  
  //loading stuff
  loading = true;
  error: string | null = null;
  
  //data from backend
  stats: DiseaseStats | null = null;
  recentImages: MangoImage[] = [];
  
  //counts
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

      //load stats
      const stats = await this.mangoDiseaseService.getDiseaseStatistics().toPromise();
      
      if (stats) {
        this.stats = stats;
        this.updateStatistics(stats);
      }

      //load recent images
      const recentImagesResponse = await this.mangoDiseaseService.getClassifiedImages().toPromise();
      
      if (recentImagesResponse) {
        this.recentImages = recentImagesResponse.images; 
      }

      //done loading
      this.loading = false;

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.error = 'Failed to load dashboard data. Please try again.';
      this.loading = false;
      
      //use backup data
      this.loadStaticData();
    }
  }

  private updateStatistics(stats: DiseaseStats) {
    this.totalImages = stats.total_images;
    this.healthyImages = stats.healthy_images;
    this.diseasedImages = stats.diseased_images;
  }



  private loadStaticData() {
    //backup data if api fails
    this.totalImages = 0;
    this.healthyImages = 0;
    this.diseasedImages = 0;
    
  }



    //go to pages
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
    //todo: add model settings page
  }

  /*async exportDataset() {
    try {
      //export moved to backend
      alert('Export functionality will be available in a future update');
    } catch (error) {
      console.error('Error exporting dataset:', error);
      alert('Failed to export dataset. Please try again.');
    }
  }*/


}