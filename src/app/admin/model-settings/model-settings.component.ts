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
  PreprocessingStatus,
  RetrainConfig,
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

  readonly defaultMobileNetConfig: RetrainConfig = {
    epochs:                  10,
    learning_rate:           0.0001,
    batch_size:              16,
    val_split:               0.2,
    unfreeze_top_n_layers:   20,
    early_stopping_patience: 3,
    lr_reduce_factor:        0.5,
    lr_reduce_patience:      2,
    min_images_per_class:    5,
    modality_dropout:        0.5,
  };

  readonly defaultHybridConfig: RetrainConfig = {
    epochs:                  50,
    learning_rate:           0.001,
    batch_size:              32,
    val_split:               0.2,
    unfreeze_top_n_layers:   0,
    early_stopping_patience: 10,
    lr_reduce_factor:        0.5,
    lr_reduce_patience:      4,
    min_images_per_class:    5,
    modality_dropout:        0.5,
  };

  get defaultRetrainConfig(): RetrainConfig {
    return this.retrainModelKind === 'hybrid_cnn'
      ? this.defaultHybridConfig
      : this.defaultMobileNetConfig;
  }

  retrainConfig: RetrainConfig = { ...this.defaultMobileNetConfig };

  // ── preprocessing state ────────────────────────────────────────────────────
  preprocessingReady    = false;
  preprocessingCount: number | null = null;
  preprocessingClasses: number | null = null;
  isCheckingPreprocessing  = false;
  isPreprocessing          = false;
  preprocessingStatus: PreprocessingStatus | null = null;
  preprocessingErrorMsg    = '';

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
  private preprocessingPollSub: Subscription | null = null;

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
    this.stopPreprocessingPolling();
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
    this.datasetInfo          = null;
    this.retrainErrorMsg      = '';
    this.retrainSuccessMsg    = '';
    this.preprocessingReady   = false;
    this.preprocessingCount   = null;
    this.preprocessingClasses = null;
    this.preprocessingStatus  = null;
    this.preprocessingErrorMsg = '';
    this.stopPreprocessingPolling();
    this.resetExtractionState();
  }

  onRetrainModelKindChange(): void {
    this.datasetInfo       = null;
    this.retrainErrorMsg   = '';
    this.retrainSuccessMsg = '';
    this.retrainConfig     = { ...this.defaultRetrainConfig };
    this.resetExtractionState();
  }

  loadDatasetInfo(): void {
    this.isLoadingDataset = true;
    this.retrainErrorMsg  = '';
    this.mangoService.getRetrainDatasetInfo(this.retrainModelType, this.retrainConfig.min_images_per_class).subscribe({
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

    this.mangoService.triggerRetrain(this.retrainModelType, this.retrainModelKind, this.retrainConfig).subscribe({
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

  // ── preprocessing methods ──────────────────────────────────────────────────

  checkPreprocessingReady(): void {
    this.isCheckingPreprocessing = true;
    this.preprocessingErrorMsg   = '';
    this.mangoService.checkPreprocessingReady(this.retrainModelType).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.preprocessingReady   = res.data.ready;
          this.preprocessingCount   = res.data.processed;
          this.preprocessingClasses = res.data.classes;
        }
        this.isCheckingPreprocessing = false;
      },
      error: () => { this.isCheckingPreprocessing = false; },
    });
  }

  startPreprocessing(): void {
    this.preprocessingErrorMsg = '';
    this.isPreprocessing       = true;
    this.mangoService.triggerPreprocessing(this.retrainModelType).subscribe({
      next: (res) => {
        if (res.success) {
          this.startPreprocessingPolling();
        } else {
          this.preprocessingErrorMsg = res.message || 'Failed to start preprocessing.';
          this.isPreprocessing       = false;
        }
      },
      error: (err) => {
        this.preprocessingErrorMsg = err?.error?.message || 'Could not start preprocessing.';
        this.isPreprocessing       = false;
      },
    });
  }

  private startPreprocessingPolling(): void {
    this.stopPreprocessingPolling();
    this.preprocessingPollSub = interval(2000)
      .pipe(
        switchMap(() => this.mangoService.getPreprocessingStatus()),
        takeWhile((res) => res.data?.is_running === true, true),
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.preprocessingStatus = res.data;
            if (!res.data.is_running) {
              this.isPreprocessing = false;
              if (res.data.phase === 'done') {
                this.preprocessingReady   = true;
                this.preprocessingCount   = res.data.processed;
              } else if (res.data.phase === 'error') {
                this.preprocessingErrorMsg = res.data.error || 'Preprocessing failed.';
              }
              this.stopPreprocessingPolling();
            }
          }
        },
        error: () => {
          this.stopPreprocessingPolling();
          this.isPreprocessing = false;
        },
      });
  }

  private stopPreprocessingPolling(): void {
    if (this.preprocessingPollSub) {
      this.preprocessingPollSub.unsubscribe();
      this.preprocessingPollSub = null;
    }
  }

  get preprocessingProgressWidth(): string {
    return `${this.preprocessingStatus?.progress ?? 0}%`;
  }

  get preprocessingPhaseLabel(): string {
    const map: Record<string, string> = {
      starting:    'Starting…',
      downloading: 'Downloading images…',
      processing:  'Preprocessing images…',
      done:        'Done',
      error:       'Error',
    };
    return map[this.preprocessingStatus?.phase ?? ''] ?? '';
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
