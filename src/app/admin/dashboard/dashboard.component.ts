import { Component, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MangoDiseaseService, DiseaseStats, MangoImage } from '../../services/mango-disease.service';
import { Router } from '@angular/router';
import { TopDisease } from './disease-trends/disease-trends.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: false
})
export class DashboardComponent implements OnInit {

  currentDate = new Date().toLocaleDateString();

  loading = true;
  error: string | null = null;

  stats: DiseaseStats | null = null;
  recentImages: MangoImage[] = [];

  totalImages    = 0;
  healthyImages  = 0;
  diseasedImages = 0;

  topDiseases: TopDisease[] = [];

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
      this.error   = null;

      const [stats, imagesResp] = await Promise.all([
        firstValueFrom(this.mangoDiseaseService.getDiseaseStatistics()),
        firstValueFrom(this.mangoDiseaseService.getClassifiedImages({ page: 1, page_size: 1000 }))
      ]);

      if (stats) {
        this.stats = stats;
        this.totalImages    = stats.total_images;
        this.healthyImages  = stats.healthy_images;
        this.diseasedImages = stats.diseased_images;
        this.buildTopDiseases(stats);
      }

      if (imagesResp) {
        this.recentImages = imagesResp.images;
      }

      this.loading = false;

    } catch (err) {
      console.error('Error loading dashboard data:', err);
      this.error   = 'Failed to load dashboard data. Please try again.';
      this.loading = false;
    }
  }

  refreshData() {
    this.loadDashboardData();
  }

  private buildTopDiseases(stats: DiseaseStats) {
    const bd = stats.diseases_breakdown;
    if (!bd) return;

    const total = Math.max(Object.values(bd).reduce((a, b) => a + b, 0), 1);

    this.topDiseases = Object.entries(bd)
      .filter(([name]) => !name.toLowerCase().includes('healthy'))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 1000) / 10,
        type: this.inferDiseaseType(name)
      }));
  }

  private inferDiseaseType(name: string): string {
    const lc = name.toLowerCase();
    if (lc.includes('leaf') || lc.includes('anthracnose') || lc.includes('powdery') || lc.includes('blight')) return 'Leaf';
    if (lc.includes('fruit') || lc.includes('rot') || lc.includes('stem') || lc.includes('tip')) return 'Fruit';
    return 'General';
  }

  navigateToUploadImages()    { this.router.navigate(['/admin/upload-images']); }
  navigateToUserManagement()  { this.router.navigate(['/admin/user-management']); }
  navigateToModelSettings()   { this.router.navigate(['/admin/model-settings']); }
}
