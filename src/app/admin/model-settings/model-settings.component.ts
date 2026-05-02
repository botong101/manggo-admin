import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import {
  MangoDiseaseService,
  ModelSettings,
  UpdateModelPayload,
  RetrainDatasetInfo,
  RetrainStatus,
  SymptomExtractionStatus,
} from '../../services/mango-disease.service';

@Component({
  selector: 'app-model-settings',
  templateUrl: './model-settings.component.html',
  styleUrls: ['./model-settings.component.css'],
  standalone: false,
})
export class ModelSettingsComponent implements OnInit, OnDestroy {
  // ── model-swap state ───────────────────────────────────────────────────────
  settings: ModelSettings | null = null;
  selectedLeafModel  = '';
  selectedFruitModel = '';

  isLoading  = false;
  isSaving   = false;
  errorMsg   = '';
  successMsg = '';

  // ── retrain state ──────────────────────────────────────────────────────────
  retrainModelType: 'leaf' | 'fruit'             = 'leaf';
  retrainModelKind: 'mobilenetv2' | 'hybrid_cnn' = 'mobilenetv2';

  datasetInfo: RetrainDatasetInfo | null = null;
  isLoadingDataset  = false;
  isRetraining      = false;
  retrainStatus: RetrainStatus | null = null;
  retrainErrorMsg   = '';
  retrainSuccessMsg = '';
  showAdvancedConfig = false;

  readonly defaultRetrainConfig: RetrainConfig = {
    epochs:                  10,
    learning_rate:           0.0001,
    batch_size:              16,
    val_split:               0.2,
    unfreeze_top_n_layers:   20,
    early_stopping_patience: 3,
    lr_reduce_factor:        0.5,
    lr_reduce_patience:      2,
    min_images_per_class:    5,
  };

  retrainConfig: RetrainConfig = { ...this.defaultRetrainConfig };

  // ── symptom extraction state (Hybrid CNN only) ─────────────────────────────
  symptomsReady    = false;
  symptomsRowCount: number | null = null;
  symptomsCSVPath: string | null  = null;
  isCheckingSymptoms   = false;
  isExtractingFeatures = false;
  extractionStatus: SymptomExtractionStatus | null = null;
  extractionErrorMsg = '';

  private pollSub: Subscription | null = null;
  private extractionPollSub: Subscription | null = null;

  constructor(
    private router: Router,
    private mangoService: MangoDiseaseService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.checkRetrainStatus();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.stopExtractionPolling();
  }

  // ── model-swap methods ─────────────────────────────────────────────────────

  loadSettings(): void {
    this.isLoading = true;
    this.errorMsg  = '';
    this.mangoService.getModelSettings().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.settings           = res.data;
          this.selectedLeafModel  = res.data.active_models.leaf;
          this.selectedFruitModel = res.data.active_models.fruit;
        } else {
          this.errorMsg = 'Failed to load model settings.';
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMsg = err?.error?.message || 'Could not reach the server.';
        this.isLoading = false;
      },
    });
  }

  saveSettings(): void {
    this.isSaving   = true;
    this.successMsg = '';
    this.errorMsg   = '';

    const payload: UpdateModelPayload = {
      leaf_model:  this.selectedLeafModel,
      fruit_model: this.selectedFruitModel,
    };

    this.mangoService.updateModelSettings(payload).subscribe({
      next: (res) => {
        if (res.success) {
          this.successMsg = 'Model settings saved successfully!';
          this.loadSettings();
        } else {
          this.errorMsg = res.message || 'Failed to save settings.';
        }
        this.isSaving = false;
      },
      error: (err) => {
        this.errorMsg = err?.error?.errors?.join(', ') || 'Save failed.';
        this.isSaving = false;
      },
    });
  }

  hasChanges(): boolean {
    if (!this.settings) return false;
    return (
      this.selectedLeafModel  !== this.settings.active_models.leaf ||
      this.selectedFruitModel !== this.settings.active_models.fruit
    );
  }

  // ── retrain methods ────────────────────────────────────────────────────────

  onRetrainModelTypeChange(): void {
    this.datasetInfo       = null;
    this.retrainErrorMsg   = '';
    this.retrainSuccessMsg = '';
    this.resetExtractionState();
  }

  onRetrainModelKindChange(): void {
    this.datasetInfo       = null;
    this.retrainErrorMsg   = '';
    this.retrainSuccessMsg = '';
    this.resetExtractionState();
  }

  loadDatasetInfo(): void {
    this.isLoadingDataset = true;
    this.retrainErrorMsg  = '';
    this.mangoService.getRetrainDatasetInfo(this.retrainModelType).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.datasetInfo = res.data;
        } else {
          this.retrainErrorMsg = 'Failed to load dataset info.';
        }
        this.isLoadingDataset = false;
      },
      error: (err) => {
        this.retrainErrorMsg = err?.error?.message || 'Could not reach the server.';
        this.isLoadingDataset = false;
      },
    });
  }

  resetRetrainConfig(): void {
    this.retrainConfig = { ...this.defaultRetrainConfig };
  }

  startRetraining(): void {
    this.retrainErrorMsg   = '';
    this.retrainSuccessMsg = '';
    this.isRetraining      = true;

    this.mangoService.triggerRetrain(this.retrainModelType, this.retrainModelKind).subscribe({
      next: (res) => {
        if (res.success) {
          this.retrainSuccessMsg = res.message || 'Retraining started.';
          this.startPolling();
        } else {
          this.retrainErrorMsg = res.message || 'Failed to start retraining.';
          this.isRetraining    = false;
        }
      },
      error: (err) => {
        this.retrainErrorMsg = err?.error?.message || 'Could not start retraining.';
        this.isRetraining    = false;
      },
    });
  }

  activateRetrainedModel(): void {
    if (!this.retrainStatus?.output_filename) return;

    const filename = this.retrainStatus.output_filename;
    const payload: UpdateModelPayload =
      this.retrainModelType === 'leaf'
        ? { leaf_model: filename }
        : { fruit_model: filename };

    this.mangoService.updateModelSettings(payload).subscribe({
      next: (res) => {
        if (res.success) {
          this.retrainSuccessMsg = `Model "${filename}" is now active.`;
          this.loadSettings();
        } else {
          this.retrainErrorMsg = res.message || 'Failed to activate model.';
        }
      },
      error: (err) => {
        this.retrainErrorMsg = err?.error?.message || 'Failed to activate model.';
      },
    });
  }

  private checkRetrainStatus(): void {
    this.mangoService.getRetrainStatus().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.retrainStatus = res.data;
          if (res.data.is_running) {
            this.isRetraining = true;
            this.startPolling();
          }
        }
      },
      error: () => {},
    });
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollSub = interval(2000)
      .pipe(
        switchMap(() => this.mangoService.getRetrainStatus()),
        takeWhile((res) => res.data?.is_running === true, true)
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.retrainStatus = res.data;
            if (!res.data.is_running) {
              this.isRetraining = false;
              if (res.data.phase === 'done') {
                this.retrainSuccessMsg =
                  `Retraining complete! Accuracy: ${res.data.accuracy}%. ` +
                  `New model: "${res.data.output_filename}"`;
                this.loadSettings();
              } else if (res.data.phase === 'error') {
                this.retrainErrorMsg = res.data.error || 'Retraining failed.';
              }
              this.stopPolling();
            }
          }
        },
        error: () => {
          this.stopPolling();
        },
      });
  }

  private stopPolling(): void {
    if (this.pollSub) {
      this.pollSub.unsubscribe();
      this.pollSub = null;
    }
  }

  // ── symptom extraction methods (Hybrid CNN) ────────────────────────────────

  private resetExtractionState(): void {
    this.symptomsReady      = false;
    this.symptomsRowCount   = null;
    this.symptomsCSVPath    = null;
    this.extractionStatus   = null;
    this.extractionErrorMsg = '';
    this.stopExtractionPolling();
  }

  checkSymptomsReady(): void {
    this.isCheckingSymptoms = true;
    this.extractionErrorMsg = '';
    this.mangoService.checkSymptomsReady(this.retrainModelType).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.symptomsReady    = res.data.ready;
          this.symptomsRowCount = res.data.rows;
          this.symptomsCSVPath  = res.data.csv_path;
        }
        this.isCheckingSymptoms = false;
      },
      error: () => {
        this.isCheckingSymptoms = false;
      },
    });
  }

  startFeatureExtraction(): void {
    this.extractionErrorMsg  = '';
    this.isExtractingFeatures = true;
    this.symptomsReady       = false;

    this.mangoService.triggerSymptomExtraction(this.retrainModelType).subscribe({
      next: (res) => {
        if (res.success) {
          this.startExtractionPolling();
        } else {
          this.extractionErrorMsg  = res.message || 'Failed to start extraction.';
          this.isExtractingFeatures = false;
        }
      },
      error: (err) => {
        this.extractionErrorMsg  = err?.error?.message || 'Could not start feature extraction.';
        this.isExtractingFeatures = false;
      },
    });
  }

  private startExtractionPolling(): void {
    this.stopExtractionPolling();
    this.extractionPollSub = interval(2000)
      .pipe(
        switchMap(() => this.mangoService.getSymptomExtractionStatus()),
        takeWhile((res) => res.data?.is_running === true, true)
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.extractionStatus = res.data;
            if (!res.data.is_running) {
              this.isExtractingFeatures = false;
              if (res.data.phase === 'done') {
                this.symptomsReady    = true;
                this.symptomsRowCount = res.data.rows_extracted;
                this.symptomsCSVPath  = res.data.output_csv;
              } else if (res.data.phase === 'error') {
                this.extractionErrorMsg = res.data.error || 'Feature extraction failed.';
              }
              this.stopExtractionPolling();
            }
          }
        },
        error: () => {
          this.stopExtractionPolling();
          this.isExtractingFeatures = false;
        },
      });
  }

  private stopExtractionPolling(): void {
    if (this.extractionPollSub) {
      this.extractionPollSub.unsubscribe();
      this.extractionPollSub = null;
    }
  }

  // ── template helpers ───────────────────────────────────────────────────────

  get eligibleClassEntries(): { name: string; count: number }[] {
    if (!this.datasetInfo?.eligible_classes) return [];
    return Object.entries(this.datasetInfo.eligible_classes).map(([name, count]) => ({
      name,
      count,
    }));
  }

  get ineligibleClassEntries(): { name: string; count: number }[] {
    if (!this.datasetInfo) return [];
    const all      = this.datasetInfo.all_classes;
    const eligible = this.datasetInfo.eligible_classes;
    return Object.entries(all)
      .filter(([name]) => !(name in eligible))
      .map(([name, count]) => ({ name, count }));
  }

  get progressBarWidth(): string {
    return `${this.retrainStatus?.progress ?? 0}%`;
  }

  get phaseLabel(): string {
    const map: Record<string, string> = {
      starting:    'Starting…',
      downloading: 'Downloading images…',
      preparing:   'Preparing dataset…',
      training:    'Training…',
      evaluating:  'Evaluating…',
      saving:      'Saving model…',
      done:        'Done',
      error:       'Error',
    };
    return map[this.retrainStatus?.phase ?? ''] ?? '';
  }

  get extractionProgressWidth(): string {
    return `${this.extractionStatus?.progress ?? 0}%`;
  }

  get extractionPhaseLabel(): string {
    const map: Record<string, string> = {
      starting:   'Starting…',
      scanning:   'Scanning images…',
      extracting: 'Extracting features…',
      saving:     'Saving CSV…',
      done:       'Done',
      error:      'Error',
    };
    return map[this.extractionStatus?.phase ?? ''] ?? '';
  }

  get canStartHybridRetrain(): boolean {
    return !!this.datasetInfo?.can_retrain && this.symptomsReady;
  }
}
