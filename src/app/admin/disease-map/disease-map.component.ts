import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ElementRef, ViewChild
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as L from 'leaflet';
import { MangoDiseaseService, DiseaseLocation } from '../../services/mango-disease.service';

// Fix Leaflet's broken default icon paths in webpack builds
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
  iconUrl:       'assets/leaflet/marker-icon.png',
  shadowUrl:     'assets/leaflet/marker-shadow.png',
});

// 12-color palette for diseases (healthy always gets green)
const PALETTE = [
  '#ef4444', // red
  '#f97316', // orange
  '#a855f7', // purple
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#ec4899', // pink
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#84cc16', // lime
  '#0ea5e9', // sky
  '#d946ef', // fuchsia
  '#f43f5e', // rose
];

@Component({
  selector: 'app-disease-map',
  templateUrl: './disease-map.component.html',
  styleUrls: ['./disease-map.component.css'],
  standalone: false
})
export class DiseaseMapComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef;

  private map?: L.Map;
  private markerLayer = L.layerGroup();

  loading       = true;
  locations: DiseaseLocation[] = [];
  uniqueDiseases: string[] = [];
  diseaseColors = new Map<string, string>();
  activeFilter  = 'all';
  totalLocations = 0;

  constructor(private svc: MangoDiseaseService) {}

  ngOnInit() {
    this.fetchLocations();
  }

  ngAfterViewInit() {
    this.initMap();
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  // ── Map init ────────────────────────────────────────────────────────

  private initMap() {
    this.map = L.map(this.mapEl.nativeElement, {
      center: [12.8797, 121.7740],   // Philippines
      zoom: 6,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    this.markerLayer.addTo(this.map);

    // Force Leaflet to recalculate size after the DOM has fully settled
    setTimeout(() => this.map?.invalidateSize(), 150);
  }

  // ── Data ─────────────────────────────────────────────────────────────

  async fetchLocations() {
    try {
      const resp = await firstValueFrom(this.svc.getDiseaseLocations());
      this.locations     = resp?.data?.locations ?? [];
      this.totalLocations = this.locations.length;

      // Deterministic color per disease — healthy is always green
      const diseases = [...new Set(this.locations.map(l => l.disease))].sort();
      this.uniqueDiseases = diseases;
      let idx = 0;
      diseases.forEach(d => {
        if (d.toLowerCase().includes('healthy')) {
          this.diseaseColors.set(d, '#22c55e');
        } else {
          this.diseaseColors.set(d, PALETTE[idx++ % PALETTE.length]);
        }
      });

      this.loading = false;
      this.renderMarkers();
    } catch {
      this.loading = false;
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────

  renderMarkers() {
    if (!this.map) return;
    this.markerLayer.clearLayers();

    const visible = this.activeFilter === 'all'
      ? this.locations
      : this.locations.filter(l => l.disease === this.activeFilter);

    visible.forEach(loc => {
      const color  = this.diseaseColors.get(loc.disease) ?? '#6b7280';
      const conf   = typeof loc.confidence === 'number' ? loc.confidence : 0.5;
      const radius = 7 + conf * 12;          // 7–19 px
      const pct    = (conf * 100).toFixed(1);
      const date   = loc.uploaded_at
        ? new Date(loc.uploaded_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
        : '—';

      const marker = L.circleMarker([loc.latitude, loc.longitude], {
        radius,
        fillColor:   color,
        color:       '#fff',
        weight:      2,
        opacity:     1,
        fillOpacity: 0.80,
      });

      marker.bindPopup(`
        <div style="font-family:'Segoe UI',sans-serif;min-width:200px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="width:12px;height:12px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
            <span style="font-weight:700;font-size:13px;color:#111827;line-height:1.2">${loc.disease}</span>
          </div>
          ${loc.address ? `<p style="margin:0 0 8px;font-size:11px;color:#6b7280;line-height:1.4">${loc.address}</p>` : ''}
          <div style="display:grid;grid-template-columns:1fr auto;gap:2px 12px;font-size:11px;color:#374151">
            <span>Confidence</span><strong>${pct}%</strong>
            <span>Detected</span><strong>${date}</strong>
          </div>
        </div>
      `, { maxWidth: 250 });

      this.markerLayer.addLayer(marker);
    });

    // Fit bounds to visible markers
    if (visible.length > 0) {
      const bounds = L.latLngBounds(
        visible.map(l => [l.latitude, l.longitude] as L.LatLngTuple)
      );
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }

  // ── Filter ────────────────────────────────────────────────────────────

  setFilter(disease: string) {
    this.activeFilter = disease;
    this.renderMarkers();
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  getColor(disease: string): string {
    return this.diseaseColors.get(disease) ?? '#6b7280';
  }

  getCount(disease: string): number {
    return this.locations.filter(l => l.disease === disease).length;
  }

  get filteredCount(): number {
    return this.activeFilter === 'all'
      ? this.locations.length
      : this.locations.filter(l => l.disease === this.activeFilter).length;
  }
}
