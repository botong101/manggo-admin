import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TrainingDataService } from '../../../services/training-data.service';
import {
  TrainingDataDetail,
  TrainingDataPatchRequest,
  TrainingSymptom,
} from '../../../services/training-data.interfaces';

@Component({
  selector: 'app-training-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './training-edit-modal.component.html',
})
export class TrainingEditModalComponent implements OnChanges {
  @Input() imageId: number | null = null;   // open when non-null
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<{ id: number; training_ready: boolean }>();

  detail: TrainingDataDetail | null = null;
  loading = false;
  saving = false;
  error: string | null = null;

  // form fields (bound via ngModel)
  formTrainingReady = false;
  formTrainingNotes = '';
  formDiseaseClassification = '';

  readonly LEAF_CLASS_NAMES  = ['Anthracnose', 'Die Back', 'Healthy', 'Powdery Mildew', 'Sooty Mold'];
  readonly FRUIT_CLASS_NAMES = ['Alternaria', 'Anthracnose', 'Black Mold Rot', 'Healthy', 'Stem end Rot'];

  detailDiseaseType = '';

  get availableClasses(): string[] {
    return this.detailDiseaseType === 'fruit' ? this.FRUIT_CLASS_NAMES : this.LEAF_CLASS_NAMES;
  }

  readonly CANONICAL_SYMPTOMS: string[] = [
    'leaf_spots', 'dark_spots_with_halo', 'concentric_rings',
    'yellow_discoloration', 'white_powdery_coating', 'black_sooty_coating',
    'leaf_curling', 'leaf_distortion', 'premature_leaf_drop',
    'tip_dieback', 'canker_lesions', 'branch_dieback',
    'fruit_black_lesions', 'fruit_brown_patches', 'fruit_rot',
    'surface_cracks', 'stem_end_rot', 'fruit_shriveling',
    'water_soaked_spots', 'fungal_growth',
  ];

  constructor(private trainingDataService: TrainingDataService) {}

  ngOnChanges(): void {
    if (this.imageId !== null) this.load();
  }

  private load(): void {
    this.loading = true;
    this.error = null;
    this.trainingDataService.getTrainingDetail(this.imageId!).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data) {
          this.detail = res.data;
          this.detailDiseaseType = res.data.disease_type || '';
          this.formTrainingReady = res.data.training_ready;
          this.formTrainingNotes = res.data.training_notes;
          this.formDiseaseClassification = res.data.disease_classification;
        }
      },
      error: () => {
        this.loading = false;
        this.error = 'Failed to load training data.';
      },
    });
  }

  save(): void {
    if (!this.imageId) return;
    this.saving = true;
    const payload: TrainingDataPatchRequest = {
      training_ready: this.formTrainingReady,
      training_notes: this.formTrainingNotes,
      disease_classification: this.formDiseaseClassification,
    };
    this.trainingDataService.patchTrainingDetail(this.imageId, payload).subscribe({
      next: (res) => {
        this.saving = false;
        if (res.success) {
          this.saved.emit({ id: this.imageId!, training_ready: this.formTrainingReady });
          this.close();
        }
      },
      error: () => {
        this.saving = false;
        this.error = 'Save failed. Please try again.';
      },
    });
  }

  close(): void {
    this.imageId = null;
    this.detail = null;
    this.closed.emit();
  }

  getSymptomLabel(s: TrainingSymptom | string): string {
    return typeof s === 'object' ? (s.label || s.key) : s;
  }

  isSymptomUnrecognised(s: TrainingSymptom | string): boolean {
    const key = typeof s === 'object' ? s.key : s;
    return !this.CANONICAL_SYMPTOMS.includes(key);
  }

  get unrecognisedSymptoms(): (TrainingSymptom | string)[] {
    if (!this.detail?.selected_symptoms) return [];
    return this.detail.selected_symptoms.filter(s => this.isSymptomUnrecognised(s));
  }
}