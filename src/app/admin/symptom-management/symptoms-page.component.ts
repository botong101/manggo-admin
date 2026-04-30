import { Component, OnInit } from '@angular/core';
import { SymptomService } from '../../services/symptom.service';
import { Symptom, SymptomPayload } from '../../models/symptom-vocabulary/symptom.model';
import { DataTableComponent, TableColumn } from '../../components/data-table/data-table.component';
import { FormField, FormModalComponent } from '../../components/form-modal/form-modal.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-symptoms-page',
  imports: [CommonModule, FormsModule, DataTableComponent, FormModalComponent, ConfirmDialogComponent], 
  template: `
    <div class="p-6 max-w-6xl mx-auto">
      <!-- Page header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">Symptoms</h1>
          <p class="text-sm text-gray-500 mt-0.5">Manage the symptom vocabulary used by the ML pipeline.</p>
        </div>
        <div class="flex items-center gap-3">
          <!-- Plant part filter -->
          <select
            [(ngModel)]="plantPartFilter"
            (ngModelChange)="onFilterChange()"
            class="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">All parts</option>
            <option value="leaf">Leaf</option>
            <option value="fruit">Fruit</option>
          </select>
          <button
            (click)="openCreateModal()"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors shadow-sm"
          >
            <span class="text-lg leading-none">+</span> Add Symptom
          </button>
        </div>
      </div>

      <!-- Toast: success -->
      <div
        *ngIf="successMessage"
        class="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm"
      >
        {{ successMessage }}
      </div>

      <!-- Toast: error -->
      <div
        *ngIf="error"
        class="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm"
      >
        {{ error }}
      </div>

      <!-- Table -->
      <app-data-table
        [columns]="columns"
        [rows]="rows"
        [loading]="loading"
        (editClick)="openEditModal($event)"
        (deleteClick)="openDeleteDialog($event)"
      ></app-data-table>

      <!-- Create / Edit modal -->
      <app-form-modal
        [open]="modalOpen"
        [title]="modalTitle"
        [fields]="fields"
        [initialData]="modalData"
        (save)="onModalSave($event)"
        (cancel)="closeModal()"
      ></app-form-modal>

      <!-- Confirm delete dialog -->
      <app-confirm-dialog
        [open]="confirmOpen"
        title="Delete Symptom"
        [message]="'Delete symptom ' + (pendingDelete?.key ?? '') + '? This will fail if the symptom is linked to a disease.'"
        (cancelClick)="confirmOpen = false"
      ></app-confirm-dialog>
    </div>
  `
})
export class SymptomsPageComponent implements OnInit {
  // ---- Table config ----
  columns: TableColumn[] = [
    { key: 'id',               label: 'ID' },
    { key: 'key',              label: 'Key (slug)' },
    { key: 'plant_part',       label: 'Plant Part' },
    { key: 'vector_index',     label: 'Vector Index', format: cellValue => cellValue == null ? '—' : String(cellValue) },
    { key: 'is_in_vocabulary', label: 'In Vocabulary', format: cellValue => cellValue ? 'Yes' : 'No' },
    { key: 'created_at',       label: 'Created', format: cellValue => new Date(cellValue).toLocaleDateString() },
  ];

  // ---- Form field config ----
  fields: FormField[] = [
    { key: 'key',              label: 'Key (slug)',    type: 'text',     required: true },
    { key: 'plant_part',       label: 'Plant Part',    type: 'select',   required: true,
      options: [{ value: 'leaf', label: 'Leaf' }, { value: 'fruit', label: 'Fruit' }] },
    { key: 'vector_index',     label: 'Vector Index',  type: 'number' },
    { key: 'is_in_vocabulary', label: 'In Vocabulary', type: 'checkbox' },
  ];

  // ---- State ----
  rows: Symptom[] = [];
  loading = false;
  error = '';
  successMessage = '';

  modalOpen = false;
  modalTitle = '';
  modalData: Partial<Symptom> = {};
  editingId: number | null = null;

  confirmOpen = false;
  pendingDelete: Symptom | null = null;

  plantPartFilter: 'leaf' | 'fruit' | '' = '';

  constructor(private symptomService: SymptomService) {}

  ngOnInit(): void {
    this.loadRows();
  }

  async loadRows(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const filters = this.plantPartFilter ? { plant_part: this.plantPartFilter as 'leaf' | 'fruit' } : undefined;
      this.rows = await this.symptomService.list(filters).toPromise() ?? [];
    } catch (httpError: any) {
      this.error = httpError?.error?.error ?? 'Failed to load symptoms.';
    } finally {
      this.loading = false;
    }
  }

  onFilterChange(): void {
    this.loadRows();
  }

  openCreateModal(): void {
    this.editingId = null;
    this.modalTitle = 'Add Symptom';
    this.modalData = { is_in_vocabulary: true };
    this.modalOpen = true;
  }

  openEditModal(selectedRow: Symptom): void {
    this.editingId = selectedRow.id;
    this.modalTitle = 'Edit Symptom';
    this.modalData = { ...selectedRow };
    this.modalOpen = true;
  }

  closeModal(): void {
    this.modalOpen = false;
  }

  async onModalSave(formValue: any): Promise<void> {
    this.error = '';
    const payload: SymptomPayload = {
      key:              formValue.key,
      plant_part:       formValue.plant_part,
      vector_index:     formValue.vector_index != null ? Number(formValue.vector_index) : null,
      is_in_vocabulary: !!formValue.is_in_vocabulary,
    };
    try {
      if (this.editingId != null) {
        await this.symptomService.update(this.editingId, payload).toPromise();
        this.showSuccess('Symptom updated.');
      } else {
        await this.symptomService.create(payload).toPromise();
        this.showSuccess('Symptom created.');
      }
      this.closeModal();
      this.loadRows();
    } catch (httpError: any) {
      this.error = httpError?.error?.error ?? 'Save failed.';
    }
  }

  openDeleteDialog(selectedRow: Symptom): void {
    this.pendingDelete = selectedRow;
    this.confirmOpen = true;
  }

  async onDeleteConfirm(): Promise<void> {
    if (!this.pendingDelete) return;
    this.confirmOpen = false;
    this.error = '';
    try {
      await this.symptomService.delete(this.pendingDelete.id).toPromise();
      this.showSuccess(`Symptom "${this.pendingDelete.key}" deleted.`);
      this.pendingDelete = null;
      this.loadRows();
    } catch (httpError: any) {
      // Backend returns 400 {error: "..."} when the symptom is linked to a DiseaseSymptom (PROTECT)
      this.error = httpError?.error?.error ?? 'Delete failed.';
      this.pendingDelete = null;
    }
  }

  private showSuccess(toastMessage: string): void {
    this.successMessage = toastMessage;
    setTimeout(() => { this.successMessage = ''; }, 3500);
  }
}