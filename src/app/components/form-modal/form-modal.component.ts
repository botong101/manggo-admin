import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'checkbox';
  options?: { value: any; label: string }[];
  required?: boolean;
}

@Component({
  selector: 'app-form-modal',
  imports: [CommonModule, FormsModule],
  template: `
    <div
      *ngIf="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
      (click)="onBackdropClick($event)"
    >
      <div
        class="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-lg font-semibold text-gray-800">{{ title }}</h2>
          <button
            (click)="cancel.emit()"
            class="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Fields -->
        <form (ngSubmit)="onSubmit()" #formRef="ngForm" class="space-y-4">
          <ng-container *ngFor="let field of fields">

            <!-- Text / Number -->
            <div *ngIf="field.type === 'text' || field.type === 'number'" class="flex flex-col gap-1">
              <label class="text-sm font-medium text-gray-700">
                {{ field.label }}
                <span *ngIf="field.required" class="text-red-500 ml-0.5">*</span>
              </label>
              <input
                [type]="field.type"
                [(ngModel)]="formData[field.key]"
                [name]="field.key"
                [required]="!!field.required"
                class="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <!-- Select -->
            <div *ngIf="field.type === 'select'" class="flex flex-col gap-1">
              <label class="text-sm font-medium text-gray-700">
                {{ field.label }}
                <span *ngIf="field.required" class="text-red-500 ml-0.5">*</span>
              </label>
              <select
                [(ngModel)]="formData[field.key]"
                [name]="field.key"
                [required]="!!field.required"
                class="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option *ngFor="let selectOption of field.options" [ngValue]="selectOption.value">{{ selectOption.label }}</option>
              </select>
            </div>

            <!-- Checkbox -->
            <div *ngIf="field.type === 'checkbox'" class="flex items-center gap-2">
              <input
                type="checkbox"
                [(ngModel)]="formData[field.key]"
                [name]="field.key"
                class="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <label class="text-sm font-medium text-gray-700">{{ field.label }}</label>
            </div>

          </ng-container>

          <!-- Footer buttons -->
          <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              (click)="cancel.emit()"
              class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class FormModalComponent implements OnChanges {
  @Input() fields: FormField[] = [];
  @Input() initialData: any = {};
  @Input() title = '';
  @Input() open = false;
  @Output() save = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  formData: { [key: string]: any } = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData'] || changes['open']) {
      // Deep-copy so edits don't mutate the parent's object
      this.formData = { ...this.initialData };
    }
  }

  onSubmit(): void {
    this.save.emit({ ...this.formData });
  }

  onBackdropClick(event: MouseEvent): void {
    this.cancel.emit();
  }
}