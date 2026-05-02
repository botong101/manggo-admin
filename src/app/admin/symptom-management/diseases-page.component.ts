import { Component, OnInit } from '@angular/core';
// Services & Models
import { DiseaseService } from '../../services/disease.service';
import {
  Disease,
  DiseasePayload,
} from '../../models/symptom-vocabulary/disease.model';
// Config Types
import {
  DataTableComponent,
  TableColumn,
} from '../../components/data-table/data-table.component';
import {
  FormField,
  FormModalComponent,
} from '../../components/form-modal/form-modal.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-diseases-page',
  imports: [
    CommonModule,
    FormsModule,
    DataTableComponent,
    FormModalComponent,
    ConfirmDialogComponent,
  ],
  template: `
    <div class="p-6 max-w-6xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">Diseases</h1>
          <p class="text-sm text-gray-500 mt-0.5">
            Manage the list of mango diseases recognized by the system.
          </p>
        </div>
        <div class="flex items-center gap-3">
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
            <span class="text-lg leading-none">+</span> Add Disease
          </button>
        </div>
      </div>

      <div
        *ngIf="successMessage"
        class="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm"
      >
        {{ successMessage }}
      </div>
      <div
        *ngIf="error"
        class="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm"
      >
        {{ error }}
      </div>

      <app-data-table
        [columns]="columns"
        [rows]="rows"
        [loading]="loading"
        (infoClick)="openDetailsModal($event)"
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
        title="Delete Disease"
        [message]="'Delete disease ' + (pendingDelete?.name ?? '') + '?'"
        (confirmClick)="onDeleteConfirm()"
        (cancelClick)="confirmOpen = false"
      ></app-confirm-dialog>
      <div
        *ngIf="detailsModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      >
        <div
          class="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div
            class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50"
          >
            <h3 class="text-lg font-semibold text-gray-800">
              {{ selectedDiseaseDetails?.name }} - Details
            </h3>
            <button
              (click)="closeDetailsModal()"
              class="text-gray-400 hover:text-gray-600"
            >
              <svg
                class="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div class="px-6 py-4 overflow-y-auto space-y-6">
            <div>
              <h4
                class="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2"
              >
                Info (Description)
              </h4>
              <p class="text-gray-600 whitespace-pre-wrap leading-relaxed">
                {{
                  selectedDiseaseDetails?.description ||
                    'No description available.'
                }}
              </p>
            </div>
            <div>
              <h4
                class="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2"
              >
                Treatment
              </h4>
              <p class="text-gray-600 whitespace-pre-wrap leading-relaxed">
                {{
                  selectedDiseaseDetails?.treatment || 'No treatment specified.'
                }}
              </p>
            </div>
          </div>

          <div
            class="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end"
          >
            <button
              (click)="closeDetailsModal()"
              class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class DiseasesPageComponent implements OnInit {
  // ---- Table config ----
  columns: TableColumn[] = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'plant_part', label: 'Plant Part' },
    {
      key: 'is_in_classifier',
      label: 'In Classifier',
      format: (cellValue) => (cellValue ? 'Yes' : 'No'),
    },
  ];

  // ---- Form field config ----
  fields: FormField[] = [
    { key: 'name', label: 'Name', type: 'text', required: true },
    {
      key: 'plant_part',
      label: 'Plant Part',
      type: 'select',
      required: true,
      options: [
        { value: 'leaf', label: 'Leaf' },
        { value: 'fruit', label: 'Fruit' },
      ],
    },
    { key: 'description', label: 'Info', type: 'text', required: true },
    { key: 'treatment', label: 'Treatment', type: 'text', required: true },
    { key: 'is_in_classifier', label: 'In Classifier', type: 'checkbox' },
  ];

  // ---- State ----
  rows: Disease[] = [];
  loading = false;
  error = '';
  successMessage = '';
  plantPartFilter: 'leaf' | 'fruit' | '' = '';

  modalOpen = false;
  modalTitle = '';
  modalData: Partial<Disease> = {};
  editingId: number | null = null;
  confirmOpen = false;
  pendingDelete: Disease | null = null;

  detailsModalOpen = false;
  selectedDiseaseDetails: Disease | null = null;

  constructor(private diseaseService: DiseaseService) {}

  ngOnInit(): void {
    this.loadRows();
  }

  async loadRows(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const filters = this.plantPartFilter
        ? { plant_part: this.plantPartFilter as 'leaf' | 'fruit' }
        : undefined;
      this.rows = (await this.diseaseService.list(filters).toPromise()) ?? [];
    } catch (httpError: any) {
      this.error = httpError?.error?.error ?? 'Failed to load diseases.';
    } finally {
      this.loading = false;
    }
  }

  onFilterChange(): void {
    this.loadRows();
  }

  openCreateModal(): void {
    this.editingId = null;
    this.modalTitle = 'Add Disease';
    this.modalData = { is_in_classifier: true };
    this.modalOpen = true;
  }

  openEditModal(selectedRow: Disease): void {
    this.editingId = selectedRow.id;
    this.modalTitle = 'Edit Disease';
    this.modalData = { ...selectedRow };
    this.modalOpen = true;
  }

  closeModal(): void {
    this.modalOpen = false;
  }

  openDetailsModal(disease: Disease): void {
    this.selectedDiseaseDetails = disease;
    this.detailsModalOpen = true;
  }

  closeDetailsModal(): void {
    this.detailsModalOpen = false;
    this.selectedDiseaseDetails = null;
  }

  async onModalSave(formValue: any): Promise<void> {
    this.error = '';
    const payload: DiseasePayload = {
      name: formValue.name,
      plant_part: formValue.plant_part,
      description: formValue.description,
      treatment: formValue.treatment,
      is_in_classifier: !!formValue.is_in_classifier,
    };

    try {
      if (this.editingId != null) {
        await this.diseaseService.update(this.editingId, payload).toPromise();
        this.showSuccess('Disease updated.');
      } else {
        await this.diseaseService.create(payload).toPromise();
        this.showSuccess('Disease created.');
      }
      this.closeModal();
      this.loadRows();
    } catch (httpError: any) {
      this.error = httpError?.error?.error ?? 'Save failed.';
    }
  }

  openDeleteDialog(selectedRow: Disease): void {
    this.pendingDelete = selectedRow;
    this.confirmOpen = true;
  }

  async onDeleteConfirm(): Promise<void> {
    if (!this.pendingDelete) return;
    this.confirmOpen = false;
    this.error = '';
    try {
      await this.diseaseService.delete(this.pendingDelete.id).toPromise();
      this.showSuccess(`Disease "${this.pendingDelete.name}" deleted.`);
      this.pendingDelete = null;
      this.loadRows();
    } catch (httpError: any) {
      this.error = httpError?.error?.error ?? 'Delete failed.';
      this.pendingDelete = null;
    }
  }

  private showSuccess(toastMessage: string): void {
    this.successMessage = toastMessage;
    setTimeout(() => {
      this.successMessage = '';
    }, 3500);
  }
}
