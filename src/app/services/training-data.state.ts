import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { TrainingDataSummary } from './training-data.interfaces';

@Injectable({ providedIn: 'root' })
export class TrainingDataState {
  private summarySubject = new BehaviorSubject<TrainingDataSummary | null>(null);
  readonly summary$ = this.summarySubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  readonly loading$ = this.loadingSubject.asObservable();

  setSummary(summary: TrainingDataSummary): void {
    this.summarySubject.next(summary);
  }

  setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }

  /** Optimistically update the count after a bulk approve */
  incrementReadyCount(delta: number): void {
    const current = this.summarySubject.value;
    if (!current) return;
    this.summarySubject.next({
      ...current,
      total_training_ready: current.total_training_ready + delta,
      verified_not_yet_approved: current.verified_not_yet_approved - delta,
    });
  }
}