import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { Chart } from 'chart.js/auto';
import { MangoDiseaseService, DiseaseStats, MangoImage, TrendPoint } from '../../services/mango-disease.service';
import { Router } from '@angular/router';

interface HeatmapCell {
  disease: string;
  count: number;
  intensity: number;
  isHealthy: boolean;
  percentage: number;
  bgColor: string;
  borderColor: string;
  textColor: string;
  badgeClass: string;
  badgeLabel: string;
}

interface TopDisease {
  name: string;
  count: number;
  percentage: number;
  type: string;
}

interface ChartPoint {
  date: string;
  label: string;
  total: number;
  healthy: number;
  diseased: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: false
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('trendCanvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;

  currentDate = new Date().toLocaleDateString();

  loading = true;
  error: string | null = null;

  stats: DiseaseStats | null = null;
  recentImages: MangoImage[] = [];

  // stat card counts
  totalImages   = 0;
  healthyImages = 0;
  diseasedImages = 0;

  // ── Heatmap ──────────────────────────────────────────────────────────
  heatmapCells: HeatmapCell[] = [];
  lowRiskCount  = 0;
  medRiskCount  = 0;
  highRiskCount = 0;

  // ── Trend chart ───────────────────────────────────────────────────────
  chartPoints: ChartPoint[] = [];
  trendPeriod      = 30;
  hasTrendData     = false;
  trendLoading     = false;
  activeTrendType: 'all' | 'leaf' | 'fruit' = 'all';
  lowDataWarning   = false;
  trendFilterEmpty = false;
  readonly trendDayOptions = [7, 14, 30];

  avgTotal    = 0;
  avgHealthy  = 0;
  avgDiseased = 0;
  healthRate  = 0;

  // top diseases for list
  topDiseases: TopDisease[] = [];

  constructor(
    private mangoDiseaseService: MangoDiseaseService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  ngAfterViewInit() {}

  ngOnDestroy() {
    this.chart?.destroy();
  }

  // ── Data loading ──────────────────────────────────────────────────────

  async loadDashboardData() {
    try {
      this.loading = true;
      this.error   = null;

      const [stats, imagesResp, trendsResp] = await Promise.all([
        firstValueFrom(this.mangoDiseaseService.getDiseaseStatistics()),
        firstValueFrom(this.mangoDiseaseService.getClassifiedImages({ page: 1, page_size: 1000 })),
        firstValueFrom(this.mangoDiseaseService.getDiseaseTrends(this.trendPeriod))
      ]);

      if (stats) {
        this.stats = stats;
        this.updateStatistics(stats);
        this.buildHeatmap(stats);
        this.buildTopDiseases(stats);
      }

      if (imagesResp) {
        this.recentImages = imagesResp.images;
      }

      if (trendsResp?.success && trendsResp.data?.daily_trends?.length) {
        this.buildTrendChart(trendsResp.data.daily_trends);
      } else if (this.recentImages.length) {
        this.buildTrendChartFromImages(this.recentImages, this.trendPeriod);
      }

      this.loading = false;

    } catch (err) {
      console.error('Error loading dashboard data:', err);
      this.error   = 'Failed to load dashboard data. Please try again.';
      this.loading = false;
      this.loadStaticData();
    }
  }

  refreshData() {
    this.loadDashboardData();
  }

  // ── Statistics ────────────────────────────────────────────────────────

  private updateStatistics(stats: DiseaseStats) {
    this.totalImages    = stats.total_images;
    this.healthyImages  = stats.healthy_images;
    this.diseasedImages = stats.diseased_images;
  }

  // ── Heatmap ───────────────────────────────────────────────────────────

  private buildHeatmap(stats: DiseaseStats) {
    const bd = stats.diseases_breakdown;
    if (!bd || !Object.keys(bd).length) return;

    const maxCount = Math.max(...Object.values(bd), 1);
    const total    = Math.max(Object.values(bd).reduce((a, b) => a + b, 0), 1);

    this.heatmapCells = Object.entries(bd)
      .sort(([, a], [, b]) => b - a)
      .map(([disease, count]) => {
        const intensity  = (count / maxCount) * 100;
        const isHealthy  = disease.toLowerCase().includes('healthy');
        const percentage = Math.round((count / total) * 1000) / 10;

        let bgColor = '', borderColor = '', textColor = '', badgeClass = '', badgeLabel = '';

        if (isHealthy) {
          const alpha = 0.12 + (intensity / 100) * 0.55;
          bgColor     = `rgba(34, 197, 94, ${alpha.toFixed(2)})`;
          borderColor = `rgba(34, 197, 94, ${(0.3 + (intensity / 100) * 0.4).toFixed(2)})`;
          textColor   = '#166534';
          badgeClass  = 'badge-healthy';
          badgeLabel  = 'Healthy';
        } else if (intensity > 66) {
          bgColor     = 'rgba(239, 68, 68, 0.18)';
          borderColor = 'rgba(239, 68, 68, 0.45)';
          textColor   = '#991b1b';
          badgeClass  = 'badge-high';
          badgeLabel  = 'High';
        } else if (intensity > 33) {
          bgColor     = 'rgba(249, 115, 22, 0.15)';
          borderColor = 'rgba(249, 115, 22, 0.40)';
          textColor   = '#9a3412';
          badgeClass  = 'badge-med';
          badgeLabel  = 'Med';
        } else {
          bgColor     = 'rgba(234, 179, 8, 0.13)';
          borderColor = 'rgba(234, 179, 8, 0.35)';
          textColor   = '#713f12';
          badgeClass  = 'badge-low';
          badgeLabel  = 'Low';
        }

        return { disease, count, intensity, isHealthy, percentage, bgColor, borderColor, textColor, badgeClass, badgeLabel };
      });

    this.lowRiskCount  = this.heatmapCells.filter(c => !c.isHealthy && c.intensity <= 33).length;
    this.medRiskCount  = this.heatmapCells.filter(c => !c.isHealthy && c.intensity > 33 && c.intensity <= 66).length;
    this.highRiskCount = this.heatmapCells.filter(c => !c.isHealthy && c.intensity > 66).length;
  }

  // ── Top diseases list ─────────────────────────────────────────────────

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

  // ── Trend chart ───────────────────────────────────────────────────────

  private buildTrendChart(raw: TrendPoint[]) {
    if (!raw.length) return;

    this.hasTrendData = true;

    this.chartPoints = raw.map(d => ({
      date:     d.date,
      label:    this.shortDateLabel(d.date),
      total:    d.total    || 0,
      healthy:  d.healthy  || 0,
      diseased: d.diseased || 0
    }));

    const n = this.chartPoints.length;
    const totalCount    = this.chartPoints.reduce((s, p) => s + p.total,    0);
    const healthyCount  = this.chartPoints.reduce((s, p) => s + p.healthy,  0);
    const diseasedCount = this.chartPoints.reduce((s, p) => s + p.diseased, 0);

    this.avgTotal    = totalCount / n;
    this.avgHealthy  = healthyCount / n;
    this.avgDiseased = diseasedCount / n;
    this.healthRate  = totalCount > 0 ? (healthyCount / totalCount) * 100 : 0;

    const isFiltered      = this.activeTrendType !== 'all';
    this.trendFilterEmpty = isFiltered && totalCount === 0;
    this.lowDataWarning   = isFiltered && totalCount > 0 && totalCount < 10;

    // Defer chart creation/update by one tick so Angular renders the canvas first
    setTimeout(() => this.renderChart(), 0);
  }

  private buildTrendChartFromImages(images: MangoImage[], days: number, type?: 'leaf' | 'fruit') {
    const source = type ? images.filter(img => img.disease_type === type) : images;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (days - 1));
    cutoff.setHours(0, 0, 0, 0);

    const trendMap = new Map<string, TrendPoint>();

    for (const image of source) {
      const uploadedAt = new Date(image.uploaded_at);
      if (isNaN(uploadedAt.getTime()) || uploadedAt < cutoff) continue;

      const dateKey = uploadedAt.toISOString().slice(0, 10);
      const existing = trendMap.get(dateKey) ?? { date: dateKey, total: 0, healthy: 0, diseased: 0 };

      existing.total += 1;
      if ((image.predicted_class || '').toLowerCase().includes('healthy')) {
        existing.healthy += 1;
      } else {
        existing.diseased += 1;
      }
      trendMap.set(dateKey, existing);
    }

    const fallbackTrends: TrendPoint[] = [];
    for (let i = 0; i < days; i++) {
      const current = new Date();
      current.setDate(current.getDate() - (days - 1 - i));
      const dateKey = current.toISOString().slice(0, 10);
      fallbackTrends.push(trendMap.get(dateKey) ?? { date: dateKey, total: 0, healthy: 0, diseased: 0 });
    }

    // Always render when a type filter is active (even all-zero = informative empty state)
    if (fallbackTrends.some(p => p.total > 0) || type) {
      this.buildTrendChart(fallbackTrends);
    }
  }

  private renderChart() {
    if (!isPlatformBrowser(this.platformId) || !this.canvasRef) return;

    const labels   = this.chartPoints.map(p => p.label);
    const healthy  = this.chartPoints.map(p => p.healthy);
    const diseased = this.chartPoints.map(p => p.diseased);

    if (this.chart) {
      // Smooth data update — no destroy/recreate
      this.chart.data.labels = labels;
      this.chart.data.datasets[0].data = healthy;
      this.chart.data.datasets[1].data = diseased;
      this.chart.update('active');
      return;
    }

    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Healthy',
            data: healthy,
            backgroundColor: 'rgba(34, 197, 94, 0.82)',
            hoverBackgroundColor: 'rgba(34, 197, 94, 1)',
            stack: 'daily',
            borderWidth: 0,
            borderRadius: 3,
            borderSkipped: false,
          },
          {
            label: 'Diseased',
            data: diseased,
            backgroundColor: 'rgba(239, 68, 68, 0.82)',
            hoverBackgroundColor: 'rgba(239, 68, 68, 1)',
            stack: 'daily',
            borderWidth: 0,
            borderRadius: 3,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleColor: '#f9fafb',
            bodyColor:  '#d1d5db',
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              title: items => items[0]?.label ?? '',
              afterBody: items => {
                const total    = items.reduce((s, i) => s + (i.raw as number), 0);
                const dis      = items.find(i => i.dataset.label === 'Diseased')?.raw as number ?? 0;
                const rate     = total > 0 ? ((dis / total) * 100).toFixed(0) : '0';
                return [`Total: ${total}`, `Disease rate: ${rate}%`];
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid:   { display: false },
            border: { display: false },
            ticks:  { color: '#9ca3af', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            grid:   { color: '#f3f4f6' },
            border: { display: false },
            ticks:  { color: '#9ca3af', font: { size: 10 }, precision: 0 },
          },
        },
      },
    });
  }

  async changeTrendPeriod(days: number) {
    if (this.trendPeriod === days) return;
    this.trendPeriod  = days;
    this.trendLoading = true;
    try {
      await this.reloadTrend();
    } catch {}
    this.trendLoading = false;
  }

  async setTrendType(type: 'all' | 'leaf' | 'fruit') {
    if (this.activeTrendType === type) return;
    this.activeTrendType = type;
    this.trendLoading    = true;
    try {
      await this.reloadTrend();
    } catch {}
    this.trendLoading = false;
  }

  private async reloadTrend() {
    if (this.activeTrendType === 'all') {
      const resp = await firstValueFrom(this.mangoDiseaseService.getDiseaseTrends(this.trendPeriod));
      if (resp?.success && resp.data?.daily_trends?.length) {
        this.buildTrendChart(resp.data.daily_trends);
      } else {
        this.buildTrendChartFromImages(this.recentImages, this.trendPeriod);
      }
    } else {
      this.buildTrendChartFromImages(this.recentImages, this.trendPeriod, this.activeTrendType);
    }
  }

  private shortDateLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ── Fallback ──────────────────────────────────────────────────────────

  private loadStaticData() {
    this.totalImages = this.healthyImages = this.diseasedImages = 0;
  }

  // ── Navigation ────────────────────────────────────────────────────────

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
    this.router.navigate(['/admin/model-settings']);
  }
}
