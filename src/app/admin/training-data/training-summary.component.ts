import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TrainingDataService } from '../../services/training-data.service';
import { TrainingDataState } from '../../services/training-data.state';
import { TrainingDataSummary, TrainingClassBreakdown } from '../../services/training-data.interfaces';
import { MangoDiseaseService, RetrainDatasetInfo } from '../../services/mango-disease.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-training-summary',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './training-summary.component.html',
  styleUrls: ['./training-summary.component.css'],
})
export class TrainingSummaryComponent implements OnInit {
  summary: TrainingDataSummary | null = null;
  loading = true;
  error: string | null = null;

  leafDatasetInfo: RetrainDatasetInfo | null = null;
  fruitDatasetInfo: RetrainDatasetInfo | null = null;

  constructor(
    private trainingDataService: TrainingDataService,
    private trainingDataState: TrainingDataState,
    private mangoService: MangoDiseaseService,
  ) {}

  ngOnInit(): void {
    this.trainingDataService.getSummary().subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data) {
          this.summary = res.data;
          this.trainingDataState.setSummary(res.data);
        }
      },
      error: () => {
        this.loading = false;
        this.error = 'Failed to load training summary.';
      },
    });

    forkJoin({
      leaf:  this.mangoService.getRetrainDatasetInfo('leaf'),
      fruit: this.mangoService.getRetrainDatasetInfo('fruit'),
    }).subscribe({
      next: ({ leaf, fruit }) => {
        if (leaf.success && leaf.data)   this.leafDatasetInfo  = leaf.data;
        if (fruit.success && fruit.data) this.fruitDatasetInfo = fruit.data;
      },
    });
  }

  get readinessPct(): number {
    if (!this.summary || this.summary.total_verified === 0) return 0;
    const pct = (this.summary.total_training_ready / this.summary.total_verified) * 100;
    return Math.min(100, Math.round(pct));  // Cap at 100%
  }

  get leafBreakdown(): TrainingClassBreakdown[] {
    return this.summary?.breakdown_by_class.filter(b => b.disease_type === 'leaf') ?? [];
  }

  get fruitBreakdown(): TrainingClassBreakdown[] {
    return this.summary?.breakdown_by_class.filter(b => b.disease_type === 'fruit') ?? [];
  }

  get leafCanRetrain(): boolean {
    return this.leafDatasetInfo?.can_retrain ?? false;
  }

  get fruitCanRetrain(): boolean {
    return this.fruitDatasetInfo?.can_retrain ?? false;
  }

  get leafEligibleCount(): number {
    return Object.keys(this.leafDatasetInfo?.eligible_classes ?? {}).length;
  }

  get fruitEligibleCount(): number {
    return Object.keys(this.fruitDatasetInfo?.eligible_classes ?? {}).length;
  }

  get leafTotalClasses(): number {
    return this.leafBreakdown.length
      || Object.keys(this.leafDatasetInfo?.all_classes ?? {}).length;
  }

  get fruitTotalClasses(): number {
    return this.fruitBreakdown.length
      || Object.keys(this.fruitDatasetInfo?.all_classes ?? {}).length;
  }

  get minImagesPerClass(): number {
    return this.leafDatasetInfo?.min_images_per_class ?? this.fruitDatasetInfo?.min_images_per_class ?? 5;
  }

  // ── Bulk import ────────────────────────────────────────────────────────────

  readonly LEAF_CLASSES  = ['Anthracnose', 'Die Back', 'Healthy', 'Powdery Mildew', 'Sooty Mold'];
  readonly FRUIT_CLASSES = ['Alternaria', 'Anthracnose', 'Black Mold Rot', 'Healthy', 'Stem end Rot'];

  showImportPanel       = false;
  importDiseaseType: 'leaf' | 'fruit' = 'leaf';
  importClassification  = '';
  importMarkReady       = true;
  importSelectedFiles: File[] = [];
  isImporting           = false;
  importResultMsg       = '';
  importResultIsError   = false;

  get importClassOptions(): string[] {
    return this.importDiseaseType === 'fruit' ? this.FRUIT_CLASSES : this.LEAF_CLASSES;
  }

  onImportTypeChange(): void {
    this.importClassification = '';
    this.importResultMsg      = '';
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.importSelectedFiles = Array.from(input.files);
      this.importResultMsg     = '';
    }
  }

  removeImportFile(index: number): void {
    this.importSelectedFiles = this.importSelectedFiles.filter((_, i) => i !== index);
  }

  submitBulkImport(): void {
    if (!this.importClassification || this.importSelectedFiles.length === 0) return;

    this.isImporting      = true;
    this.importResultMsg  = '';

    const fd = new FormData();
    fd.append('disease_type',          this.importDiseaseType);
    fd.append('disease_classification', this.importClassification);
    fd.append('training_ready',        String(this.importMarkReady));
    this.importSelectedFiles.forEach(f => fd.append('images', f, f.name));

    this.trainingDataService.bulkImport(fd).subscribe({
      next: (res) => {
        this.isImporting         = false;
        this.importResultIsError = res.errors.length > 0 && res.created === 0;
        this.importResultMsg     = res.message;
        if (res.created > 0) {
          this.importSelectedFiles = [];
          this.ngOnInit();
        }
      },
      error: (err) => {
        this.isImporting         = false;
        this.importResultIsError = true;
        this.importResultMsg     = err?.error?.message || 'Import failed.';
      },
    });
  }
}
