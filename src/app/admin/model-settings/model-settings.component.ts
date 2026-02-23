import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  MangoDiseaseService,
  ModelSettings,
  UpdateModelPayload,
} from '../../services/mango-disease.service';

@Component({
  selector: 'app-model-settings',
  templateUrl: './model-settings.component.html',
  styleUrls: ['./model-settings.component.css'],
  standalone: false,
})
export class ModelSettingsComponent implements OnInit {
  settings: ModelSettings | null = null;
  selectedLeafModel  = '';
  selectedFruitModel = '';

  isLoading  = false;
  isSaving   = false;
  errorMsg   = '';
  successMsg = '';

  constructor(
    private router: Router,
    private mangoService: MangoDiseaseService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.isLoading = true;
    this.errorMsg  = '';
    this.mangoService.getModelSettings().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.settings          = res.data;
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
          this.loadSettings(); // refresh to confirm
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
}