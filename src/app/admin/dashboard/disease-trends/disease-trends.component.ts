import { Component, Input, OnInit, OnChanges, OnDestroy, ViewChild, ElementRef, Inject, PLATFORM_ID, SimpleChanges } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { Chart } from 'chart.js/auto';
import { MangoDiseaseService, MangoImage, TrendPoint } from '../../../services/mango-disease.service';
import { CsvExportService } from '../../../services/csv-export.service';

interface ChartPoint {
  date: string;
  label: string;
  total: number;
  healthy: number;
  diseased: number;
}

export interface TopDisease {
  name: string;
  count: number;
  percentage: number;
  type: string;
}

@Component({
  selector: 'app-disease-trends',
  templateUrl: './disease-trends.component.html',
  styleUrls: ['./disease-trends.component.css'],
  standalone: false
})
export class DiseaseTrendsComponent implements OnInit, OnChanges, OnDestroy {

  @Input() recentImages: MangoImage[] = [];
  @Input() topDiseases: TopDisease[] = [];

  @ViewChild('trendCanvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;

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

  constructor(
    private mangoDiseaseService: MangoDiseaseService,
    private csvExport: CsvExportService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit() {
    this.reloadTrend();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['recentImages'] && !this.hasTrendData && this.recentImages.length) {
      this.buildTrendChartFromImages(this.recentImages, this.trendPeriod);
    }
  }

  ngOnDestroy() {
    this.chart?.destroy();
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

  // ── CSV Export ────────────────────────────────────────────────────────

  exportTrendsCsv(): void {
    const formatDate = (iso: string): string => {
      const d = new Date(iso + 'T00:00:00');
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      });
    };

    const trendColumns = [
      { key: 'date', label: 'Date', format: (v: string) => formatDate(v) },
      { key: 'total', label: 'Total' },
      { key: 'healthy', label: 'Healthy' },
      { key: 'diseased', label: 'Diseased' },
      {
        key: 'diseased',
        label: 'Disease Rate (%)',
        format: (_: number, row: any) =>
          row.total > 0 ? ((row.diseased / row.total) * 100).toFixed(1) : '0.0',
      },
    ];

    const filteredTrendRows = this.chartPoints.filter(
      (row) => row.total !== 0 || row.healthy !== 0 || row.diseased !== 0,
    );

    const diseaseColumns = [
      { key: 'rank', label: 'Rank' },
      { key: 'name', label: 'Disease Name' },
      { key: 'type', label: 'Type' },
      { key: 'count', label: 'Count' },
      {
        key: 'percentage',
        label: 'Percentage (%)',
        format: (v: number) => v.toFixed(1),
      },
    ];
    const topRows = this.topDiseases.map((d, i) => ({ rank: i + 1, ...d }));

    this.csvExport.exportCombined(
      [
        {
          title: `Daily Trends (Last ${this.trendPeriod} Days)`,
          rows: filteredTrendRows,
          columns: trendColumns,
        },
        {
          title: 'Top Detected Diseases',
          rows: topRows,
          columns: diseaseColumns,
        },
      ],
      this.csvExport.filename(`disease-trends-${this.trendPeriod}d`),
    );
  }
}
