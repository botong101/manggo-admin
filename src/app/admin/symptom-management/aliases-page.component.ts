import { Component, OnInit } from '@angular/core';
// Keep the imports at the top for types and services
import { SymptomAliasService } from '../../services/symptom-alias.service';
import { SymptomAlias, SymptomAliasPayload } from '../../models/symptom-vocabulary/symptom-alias.model';
import { DataTableComponent, TableColumn } from '../../components/data-table/data-table.component';
import { FormField, FormModalComponent } from '../../components/form-modal/form-modal.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-aliases-page',
  imports: [CommonModule, FormsModule, DataTableComponent, FormModalComponent, ConfirmDialogComponent],   
  template: `
    <div class="p-6 max-w-6xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">Symptom Aliases</h1>
          <p class="text-sm text-gray-500 mt-0.5">Map variations of symptom names to their canonical versions.</p>
        </div>
        <div class="flex items-center gap-3">
          <button
            (click)="openCreateModal()"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors shadow-sm"
          >
            <span class="text-lg leading-none">+</span> Add Alias
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
        title="Delete Alias"
        [message]="'Delete alias ' + (pendingDelete?.alias ?? '') + '?'"
        (confirmClick)="onDeleteConfirm()"
        (cancelClick)="confirmOpen = false"
      ></app-confirm-dialog>
    </div>
  `
})
export class AliasesPageComponent implements OnInit {
  // ... Logic remains exactly the same ...
  columns: TableColumn[] = [
    { key: 'id',            label: 'ID' },
    { key: 'alias',         label: 'Alias (slug)' },
    { key: 'canonical',     label: 'Canonical ID' },
    { key: 'canonical_key', label: 'Canonical Key' },
    { key: 'source',        label: 'Source' },
  ];

  fields: FormField[] = [
    { key: 'alias',     label: 'Alias (slug)', type: 'text',   required: true },
    { key: 'canonical', label: 'Symptom ID',   type: 'number', required: true },
    { key: 'source',    label: 'Source',      type: 'text' },
  ];

  rows: SymptomAlias[] = [];
  loading = false;
  error = '';
  successMessage = '';
  modalOpen = false;
  modalTitle = '';
  modalData: Partial<SymptomAlias> = {};
  editingId: number | null = null;
  confirmOpen = false;
  pendingDelete: SymptomAlias | null = null;

  constructor(private aliasService: SymptomAliasService) {}

  ngOnInit(): void {
    this.loadRows();
  }

  async loadRows(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      this.rows = await this.aliasService.list().toPromise() ?? [];
    } catch (httpError: any) {
      this.error = httpError?.error?.error ?? 'Failed to load aliases.';
    } finally {
      this.loading = false;
    }
  }

  openCreateModal(): void {
    this.editingId = null;
    this.modalTitle = 'Add Alias';
    this.modalData = {};
    this.modalOpen = true;
  }

  openEditModal(selectedRow: SymptomAlias): void {
    this.editingId = selectedRow.id;
    this.modalTitle = 'Edit Alias';
    this.modalData = { ...selectedRow };
    this.modalOpen = true;
  }

  closeModal(): void {
    this.modalOpen = false;
  }

  async onModalSave(formValue: any): Promise<void> {
    this.error = '';
    const payload: SymptomAliasPayload = {
      alias:     formValue.alias,
      canonical: Number(formValue.canonical),
      source:    formValue.source ?? '',
    };

    try {
      if (this.editingId != null) {
        await this.aliasService.update(this.editingId, payload).toPromise();
        this.showSuccess('Alias updated.');
      } else {
        await this.aliasService.create(payload).toPromise();
        this.showSuccess('Alias created.');
      }
      this.closeModal();
      this.loadRows();
    } catch (httpError: any) {
      this.error = httpError?.error?.error ?? 'Save failed.';
    }
  }

  openDeleteDialog(selectedRow: SymptomAlias): void {
    this.pendingDelete = selectedRow;
    this.confirmOpen = true;
  }

  async onDeleteConfirm(): Promise<void> {
    if (!this.pendingDelete) return;
    this.confirmOpen = false;
    this.error = '';
    try {
      await this.aliasService.delete(this.pendingDelete.id).toPromise();
      this.showSuccess(`Alias "${this.pendingDelete.alias}" deleted.`);
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