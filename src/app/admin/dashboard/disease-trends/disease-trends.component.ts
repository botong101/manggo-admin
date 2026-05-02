import { Component, Input, OnInit, OnChanges, OnDestroy, ViewChild, ElementRef, Inject, PLATFORM_ID, SimpleChanges } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Chart } from 'chart.js/auto';
import { MangoImage, TrendPoint } from '../../../services/mango-disease.service';
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
  hasTrendData     = false;
  trendLoading     = false;
  activeTrendType: 'all' | 'leaf' | 'fruit' = 'all';
  lowDataWarning   = false;
  trendFilterEmpty = false;

  // Month picker — defaults to current month, never goes past today
  selectedMonth: string = new Date().toISOString().slice(0, 7);
  readonly maxMonth:    string = new Date().toISOString().slice(0, 7);

  avgTotal    = 0;
  avgHealthy  = 0;
  avgDiseased = 0;
  healthRate  = 0;

  constructor(
    private csvExport: CsvExportService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit() {
    this.reloadTrend();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['recentImages'] && !this.hasTrendData && this.recentImages.length) {
      this.buildTrendChartForMonth(this.recentImages, this.selectedMonth);
    }
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }

  // ── Derived label for the chart header ───────────────────────────────
  get selectedMonthLabel(): string {
    const [year, month] = this.selectedMonth.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }

  // ── Trend chart core ──────────────────────────────────────────────────

  private buildTrendChart(raw: TrendPoint[]) {
    if (!raw.length) return;

    this.hasTrendData = true;

    this.chartPoints = raw.map(d => ({
      date:     d.date,
      label:    this.dayLabel(d.date),
      total:    d.total    || 0,
      healthy:  d.healthy  || 0,
      diseased: d.diseased || 0,
    }));

    const n            = this.chartPoints.length;
    const totalCount   = this.chartPoints.reduce((s, p) => s + p.total,    0);
    const healthyCount = this.chartPoints.reduce((s, p) => s + p.healthy,  0);
    const diseasedCount= this.chartPoints.reduce((s, p) => s + p.diseased, 0);

    this.avgTotal    = totalCount   / n;
    this.avgHealthy  = healthyCount / n;
    this.avgDiseased = diseasedCount/ n;
    this.healthRate  = totalCount > 0 ? (healthyCount / totalCount) * 100 : 0;

    const isFiltered      = this.activeTrendType !== 'all';
    this.trendFilterEmpty = isFiltered && totalCount === 0;
    this.lowDataWarning   = isFiltered && totalCount > 0 && totalCount < 10;

    setTimeout(() => this.renderChart(), 0);
  }

  /** Build chart from locally loaded images for the given YYYY-MM month. */
  private buildTrendChartForMonth(images: MangoImage[], yearMonth: string, type?: 'leaf' | 'fruit') {
    const [year, month] = yearMonth.split('-').map(Number);
    const daysInMonth   = new Date(year, month, 0).getDate();
    const source        = type ? images.filter(img => img.disease_type === type) : images;

    const trendMap = new Map<string, TrendPoint>();

    for (const image of source) {
      const uploadedAt = new Date(image.uploaded_at);
      if (isNaN(uploadedAt.getTime())) continue;

      // Only include images whose upload date falls within the selected month
      if (uploadedAt.toISOString().slice(0, 7) !== yearMonth) continue;

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

    // Emit a point for every day of the month (zeros for days with no data)
    const monthPoints: TrendPoint[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${yearMonth}-${String(d).padStart(2, '0')}`;
      monthPoints.push(trendMap.get(dateKey) ?? { date: dateKey, total: 0, healthy: 0, diseased: 0 });
    }

    // Always render (shows zero bars) unless it's a type filter with truly no data
    if (!type || monthPoints.some(p => p.total > 0)) {
      this.buildTrendChart(monthPoints);
    } else {
      this.hasTrendData     = true;
      this.trendFilterEmpty = true;
      this.chartPoints      = monthPoints.map(d => ({ ...d, label: this.dayLabel(d.date) }));
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
              title: items => {
                // Show full date in tooltip (from chartPoints since label is just the day)
                const idx  = items[0]?.dataIndex ?? 0;
                const date = this.chartPoints[idx]?.date ?? '';
                return date
                  ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                  : items[0]?.label ?? '';
              },
              afterBody: items => {
                const total = items.reduce((s, i) => s + (i.raw as number), 0);
                const dis   = items.find(i => i.dataset.label === 'Diseased')?.raw as number ?? 0;
                const rate  = total > 0 ? ((dis / total) * 100).toFixed(0) : '0';
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
            ticks:  { color: '#9ca3af', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 16 },
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

  // ── Event handlers ────────────────────────────────────────────────────

  async onMonthChange() {
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
    const type = this.activeTrendType === 'all' ? undefined : this.activeTrendType;
    this.buildTrendChartForMonth(this.recentImages, this.selectedMonth, type);
  }

  /** Show just the day number as the bar label (e.g. "1", "15", "31"). */
  private dayLabel(dateStr: string): string {
    return String(new Date(dateStr + 'T00:00:00').getDate());
  }

  // ── CSV Export ────────────────────────────────────────────────────────

  exportTrendsCsv(): void {
    const formatDate = (iso: string): string =>
      new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: '2-digit',
      });

    const trendColumns = [
      { key: 'date',     label: 'Date',    format: (v: string) => formatDate(v) },
      { key: 'total',    label: 'Total' },
      { key: 'healthy',  label: 'Healthy' },
      { key: 'diseased', label: 'Diseased' },
      {
        key: 'diseased',
        label: 'Disease Rate (%)',
        format: (_: number, row: any) =>
          row.total > 0 ? ((row.diseased / row.total) * 100).toFixed(1) : '0.0',
      },
    ];

    const filteredTrendRows = this.chartPoints.filter(r => r.total > 0);

    const diseaseColumns = [
      { key: 'rank',       label: 'Rank' },
      { key: 'name',       label: 'Disease Name' },
      { key: 'type',       label: 'Type' },
      { key: 'count',      label: 'Count' },
      { key: 'percentage', label: 'Percentage (%)', format: (v: number) => v.toFixed(1) },
    ];
    const topRows = this.topDiseases.map((d, i) => ({ rank: i + 1, ...d }));

    this.csvExport.exportCombined(
      [
        {
          title: `Daily Trends — ${this.selectedMonthLabel}`,
          rows: filteredTrendRows,
          columns: trendColumns,
        },
        {
          title: 'Top Detected Diseases',
          rows: topRows,
          columns: diseaseColumns,
        },
      ],
      this.csvExport.filename(`disease-trends-${this.selectedMonth}`),
    );
  }
}
