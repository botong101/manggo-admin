import { Component, OnInit } from '@angular/core';
// Services & Models
import { DiseaseSymptomService } from '../../services/disease-symptom.service';
import { DiseaseSymptom, DiseaseSymptomPayload } from '../../models/symptom-vocabulary/disease-symptom.model';
// Components & Config Types
import { DataTableComponent, TableColumn } from '../../components/data-table/data-table.component';
import { FormField, FormModalComponent } from '../../components/form-modal/form-modal.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-disease-symptoms-page',
  imports: [CommonModule, FormsModule, DataTableComponent, FormModalComponent, ConfirmDialogComponent],  
  template: `
    <div class="p-6 max-w-6xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">Disease-Symptom Links</h1>
          <p class="text-sm text-gray-500 mt-0.5">Map symptoms to specific diseases for the detection pipeline.</p>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-600">Filter by Disease ID:</span>
            <input
              type="number"
              [(ngModel)]="diseaseFilter"
              (ngModelChange)="onFilterChange()"
              placeholder="All diseases"
              class="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            (click)="openCreateModal()"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors shadow-sm"
          >
            <span class="text-lg leading-none">+</span> Link Symptom
          </button>
        </div>
      </div>

      <div *ngIf="successMessage" class="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
        {{ successMessage }}
      </div>
      <div *ngIf="error" class="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
        {{ error }}
      </div>

      <app-data-table
        [columns]="columns"
        [rows]="rows"
        [loading]="loading"
        (editClick)="openEditModal($event)"
        (deleteClick)="openDeleteDialog($event)"
      ></app-data-table>

      <app-form-modal
        [open]="modalOpen"
        [title]="modalTitle"
        [fields]="fields"
        [initialData]="modalData"
        (save)="onModalSave($event)"
        (cancel)="closeModal()"
      ></app-form-modal>

      <app-confirm-dialog
        [open]="confirmOpen"
        title="Remove Link"
        [message]="'Delete symptom link #' + (pendingDelete?.id ?? '') + '?'"
        (confirmClick)="onDeleteConfirm()"
        (cancelClick)="confirmOpen = false"
      ></app-confirm-dialog>
    </div>
  `
})
export class DiseaseSymptomsPageComponent implements OnInit {
  // ---- Table config ----
  columns: TableColumn[] = [
    { key: 'id',            label: 'ID' },
    { key: 'disease_name',  label: 'Disease' },
    { key: 'symptom_key',   label: 'Symptom Key' },
    { key: 'display_label', label: 'Display Label' },
    { key: 'display_order', label: 'Order' },
  ];

  // ---- Form field config ----
  fields: FormField[] = [
    { key: 'disease',       label: 'Disease ID',     type: 'number', required: true },
    { key: 'symptom',       label: 'Symptom ID',     type: 'number', required: true },
    { key: 'display_label', label: 'Display Label',  type: 'text' },
    { key: 'display_order', label: 'Display Order',  type: 'number' },
  ];

  // ---- State ----
  rows: DiseaseSymptom[] = [];
  loading = false;
  error = '';
  successMessage = '';
  diseaseFilter: number | null = null;

  modalOpen = false;
  modalTitle = '';
  modalData: Partial<DiseaseSymptom> = {};
  editingId: number | null = null;

  confirmOpen = false;
  pendingDelete: DiseaseSymptom | null = null;

  constructor(private dsService: DiseaseSymptomService) {}

  ngOnInit(): void {
    this.loadRows();
  }

  async loadRows(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const filters = this.diseaseFilter !== null ? { disease: this.diseaseFilter } : undefined;
      this.rows = await this.dsService.list(filters).toPromise() ?? [];
    } catch (httpError: any) {
      this.error = httpError?.error?.error ?? 'Failed to load disease-symptom links.';
    } finally {
      this.loading = false;
    }
  }

  onFilterChange(): void {
    this.loadRows();
  }

  openCreateModal(): void {
    this.editingId = null;
    this.modalTitle = 'Link Symptom to Disease';
    this.modalData = { display_order: 0 };
    this.modalOpen = true;
  }

  openEditModal(selectedRow: DiseaseSymptom): void {
    this.editingId = selectedRow.id;
    this.modalTitle = 'Edit Link';
    this.modalData = { ...selectedRow };
    this.modalOpen = true;
  }

  closeModal(): void {
    this.modalOpen = false;
  }

  async onModalSave(formValue: any): Promise<void> {
    this.error = '';
    const payload: DiseaseSymptomPayload = {
      disease:       Number(formValue.disease),
      symptom:       Number(formValue.symptom),
      display_label: formValue.display_label ?? '',
      display_order: formValue.display_order != null ? Number(formValue.display_order) : 0,
    };

    try {
      if (this.editingId != null) {
        await this.dsService.update(this.editingId, payload).toPromise();
        this.showSuccess('Link updated.');
      } else {
        await this.dsService.create(payload).toPromise();
        this.showSuccess('Link created.');
      }
      this.closeModal();
      this.loadRows();
    } catch (httpError: any) {
      this.error = httpError?.error?.error ?? 'Save failed. Check for duplicate display orders.';
    }
  }

  openDeleteDialog(selectedRow: DiseaseSymptom): void {
    this.pendingDelete = selectedRow;
    this.confirmOpen = true;
  }

  async onDeleteConfirm(): Promise<void> {
    if (!this.pendingDelete) return;
    this.confirmOpen = false;
    this.error = '';
    try {
      await this.dsService.delete(this.pendingDelete.id).toPromise();
      this.showSuccess(`Link #${this.pendingDelete.id} deleted.`);
      this.pendingDelete = null;
      this.loadRows();
    } catch (httpError: any) {
      this.error = httpError?.error?.error ?? 'Delete failed.';
      this.pendingDelete = null;
    }
  }

  private showSuccess(toastMessage: string): void {
    this.successMessage = toastMessage;
    setTimeout(() => { this.successMessage = ''; }, 3500);
  }
}