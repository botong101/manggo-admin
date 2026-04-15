import { Component, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MangoDiseaseService, DiseaseStats, MangoImage, TrendPoint } from '../../services/mango-disease.service';
import { Router } from '@angular/router';

interface HeatmapCell {
  disease: string;
  count: number;
  intensity: number;   // 0–100
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
export class DashboardComponent implements OnInit {

  currentDate = new Date().toLocaleDateString();

  loading = true;
  error: string | null = null;

  stats: DiseaseStats | null = null;
  recentImages: MangoImage[] = [];

  // stat card counts
  totalImages = 0;
  healthyImages = 0;
  diseasedImages = 0;

  // ── Heatmap ──────────────────────────────────────────────────────────
  heatmapCells: HeatmapCell[] = [];
  lowRiskCount  = 0;
  medRiskCount  = 0;
  highRiskCount = 0;

  // ── Trend chart ───────────────────────────────────────────────────────
  chartPoints: ChartPoint[] = [];
  trendPeriod = 30;
  hasTrendData = false;

  // SVG coordinate constants
  readonly svgW  = 620;
  readonly svgH  = 210;
  readonly cLeft = 52;    // chart area left edge in SVG coords
  readonly cTop  = 10;    // chart area top edge
  readonly cW    = 555;   // chart area width
  readonly cH    = 155;   // chart area height

  totalPolyline    = '';
  healthyPolyline  = '';
  diseasedPolyline = '';

  trendMaxVal  = 1;
  avgTotal     = 0;
  avgHealthy   = 0;
  avgDiseased  = 0;
  peakLabel    = '';

  yAxisLabels: { y: number; val: number }[] = [];
  xAxisLabels: { x: number; label: string }[] = [];

  // top diseases for list
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

      const [stats, imagesResp, trendsResp] = await Promise.all([
        firstValueFrom(this.mangoDiseaseService.getDiseaseStatistics()),
        firstValueFrom(this.mangoDiseaseService.getClassifiedImages()),
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

    const allVals     = this.chartPoints.flatMap(p => [p.total, p.healthy, p.diseased]);
    this.trendMaxVal  = Math.max(...allVals, 1);

    const n          = this.chartPoints.length;
    this.avgTotal    = Math.round(this.chartPoints.reduce((s, p) => s + p.total, 0) / n);
    this.avgHealthy  = Math.round(this.chartPoints.reduce((s, p) => s + p.healthy, 0) / n);
    this.avgDiseased = Math.round(this.chartPoints.reduce((s, p) => s + p.diseased, 0) / n);

    const peak   = this.chartPoints.reduce((m, p) => p.total > m.total ? p : m, this.chartPoints[0]);
    this.peakLabel = peak.label;

    this.totalPolyline    = this.pointsStr(this.chartPoints.map(p => p.total));
    this.healthyPolyline  = this.pointsStr(this.chartPoints.map(p => p.healthy));
    this.diseasedPolyline = this.pointsStr(this.chartPoints.map(p => p.diseased));

    // y-axis labels (5 evenly spaced ticks)
    this.yAxisLabels = [0, 1, 2, 3, 4].map(i => ({
      y:   this.cTop + this.cH - (i / 4) * this.cH,
      val: Math.round((i / 4) * this.trendMaxVal)
    }));

    // x-axis labels: ~6 ticks
    const step = Math.max(1, Math.floor(n / 6));
    const indices: number[] = [];
    for (let i = 0; i < n; i += step) indices.push(i);
    if (indices[indices.length - 1] !== n - 1) indices.push(n - 1);

    this.xAxisLabels = indices.map(i => ({
      x:     this.ptX(i, n),
      label: this.chartPoints[i].label
    }));
  }

  /** Convert a data value + index to SVG polyline points string */
  private pointsStr(values: number[]): string {
    const n = values.length;
    return values.map((v, i) => {
      const x = this.ptX(i, n);
      const y = this.cTop + this.cH - (this.trendMaxVal > 0 ? (v / this.trendMaxVal) * this.cH : 0);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  private ptX(i: number, n: number): number {
    return this.cLeft + (n > 1 ? (i / (n - 1)) * this.cW : this.cW / 2);
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
