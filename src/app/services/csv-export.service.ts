import { Injectable } from '@angular/core';

export interface CsvColumn {
  key: string;
  label: string;
  format?: (value: any, row?: any) => string;
}

@Injectable({ providedIn: 'root' })
export class CsvExportService {
  /**
   * Build a CSV string from rows + column definitions and trigger a browser download.
   * @param rows     Array of plain objects (same shape as your table rows).
   * @param columns  Column definitions — reuse your TableColumn[] directly.
   * @param filename Desired file name, e.g. 'symptoms-2026-04-30.csv'.
   */
  export(rows: any[], columns: CsvColumn[], filename: string): void {
    const header = columns.map((c) => this.escape(c.label)).join(',');

    const body = rows.map((row) =>
      columns
        .map((col) => {
          const raw = row[col.key];
          const formatted = col.format
            ? col.format(raw, row)
            : raw == null
              ? ''
              : String(raw);
          return this.escape(formatted);
        })
        .join(','),
    );

    const csv = [header, ...body].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);
  }

  exportCombined(
    sections: { title: string; rows: any[]; columns: CsvColumn[] }[],
    filename: string,
  ): void {
    const parts: string[] = [];

    for (const section of sections) {
      parts.push(section.title);
      parts.push(section.columns.map((c) => this.escape(c.label)).join(','));

      for (const row of section.rows) {
        parts.push(
          section.columns
            .map((col) => {
              const raw = row[col.key];
              const formatted = col.format
                ? col.format(raw, row)
                : raw == null
                  ? ''
                  : String(raw);
              return this.escape(formatted);
            })
            .join(','),
        );
      }

      parts.push('');
    }

    const csv = parts.join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);
  }

  /** Wrap a cell value in double-quotes and escape internal double-quotes. */
  private escape(value: string): string {
    const str = value == null ? '' : String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /** Helper: build a datestamped filename. */
  filename(base: string): string {
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `${base}-${stamp}.csv`;
  }
}
