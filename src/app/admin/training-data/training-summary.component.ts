import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrainingDataService } from '../../services/training-data.service';
import { TrainingDataState } from '../../services/training-data.state';
import { TrainingDataSummary, TrainingClassBreakdown } from '../../services/training-data.interfaces';

@Component({
  selector: 'app-training-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './training-summary.component.html',
  styleUrls: ['./training-summary.component.css'], 
})
export class TrainingSummaryComponent implements OnInit {
  summary: TrainingDataSummary | null = null;
  loading = true;
  error: string | null = null;

  constructor(
    private trainingDataService: TrainingDataService,
    private trainingDataState: TrainingDataState,
  ) {}

  ngOnInit(): void {
    this.trainingDataService.getSummary().subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data) {
          this.summary = res.data;
          this.trainingDataState.setSummary(res.data);
        }
      },
      error: () => {
        this.loading = false;
        this.error = 'Failed to load training summary.';
      },
    });
  }

  get readinessPct(): number {
    if (!this.summary || this.summary.total_verified === 0) return 0;
    return Math.round(
      (this.summary.total_training_ready / this.summary.total_verified) * 100
    );
  }

  get leafBreakdown(): TrainingClassBreakdown[] {
    return this.summary?.breakdown_by_class.filter(b => b.disease_type === 'leaf') ?? [];
  }

  get fruitBreakdown(): TrainingClassBreakdown[] {
    return this.summary?.breakdown_by_class.filter(b => b.disease_type === 'fruit') ?? [];
  }
}