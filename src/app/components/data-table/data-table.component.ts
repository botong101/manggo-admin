import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

export interface TableColumn {
  key: string;
  label: string;
  format?: (value: any) => string;
  wrap?: boolean;      // allow cell text to wrap (default: nowrap)
  maxWidth?: string;   // e.g. '260px' — constrains the column width
}

@Component({
  selector: 'app-data-table',
  imports: [CommonModule],
  template: `
    <div class="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <!-- Loading overlay -->
      <div
        *ngIf="loading"
        class="flex items-center justify-center py-16 text-gray-500 text-sm"
      >
        <svg
          class="animate-spin h-5 w-5 mr-2 text-green-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8z"
          ></path>
        </svg>
        Loading...
      </div>

      <!-- Table -->
      <table
        *ngIf="!loading"
        class="min-w-full divide-y divide-gray-200 text-sm"
      >
        <thead class="bg-gray-50">
          <tr>
            <th
              *ngFor="let column of columns"
              class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
            >
              {{ column.label }}
            </th>
            <th
              class="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-100">
          <tr *ngIf="rows.length === 0">
            <td
              [colSpan]="columns.length + 1"
              class="px-4 py-10 text-center text-gray-400 text-sm"
            >
              No records found.
            </td>
          </tr>
          <tr
            *ngFor="let tableRow of rows"
            class="hover:bg-gray-50 transition-colors"
          >
            <td
              *ngFor="let column of columns"
              class="px-4 py-3 text-gray-700 whitespace-nowrap"
            >
              {{
                column.format
                  ? column.format(tableRow[column.key])
                  : tableRow[column.key]
              }}
            </td>
            <td class="px-4 py-3 text-right whitespace-nowrap space-x-2">
              <button
                *ngIf="router.url === '/admin/diseases'"
                (click)="infoClick.emit(tableRow)"
                class="inline-flex items-center px-3 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                Info
              </button>
              <button
                (click)="editClick.emit(tableRow)"
                class="inline-flex items-center px-3 py-1 rounded text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
              >
                Edit
              </button>
              <button
                (click)="deleteClick.emit(tableRow)"
                class="inline-flex items-center px-3 py-1 rounded text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
})
export class DataTableComponent {
  @Input() columns: TableColumn[] = [];
  @Input() rows: any[] = [];
  @Input() loading = false;
  @Output() infoClick = new EventEmitter<any>();
  @Output() editClick = new EventEmitter<any>();
  @Output() deleteClick = new EventEmitter<any>();

  constructor(public router: Router) {}
}
