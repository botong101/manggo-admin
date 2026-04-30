import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TrainingDataService } from '../../services/training-data.service';
import { TrainingDataState } from '../../services/training-data.state';
import { TrainingDataSummary, TrainingClassBreakdown } from '../../services/training-data.interfaces';
import { MangoDiseaseService, RetrainDatasetInfo } from '../../services/mango-disease.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-training-summary',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './training-summary.component.html',
  styleUrls: ['./training-summary.component.css'],
})
export class TrainingSummaryComponent implements OnInit {
  summary: TrainingDataSummary | null = null;
  loading = true;
  error: string | null = null;

  leafDatasetInfo: RetrainDatasetInfo | null = null;
  fruitDatasetInfo: RetrainDatasetInfo | null = null;

  constructor(
    private trainingDataService: TrainingDataService,
    private trainingDataState: TrainingDataState,
    private mangoService: MangoDiseaseService,
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

    forkJoin({
      leaf:  this.mangoService.getRetrainDatasetInfo('leaf'),
      fruit: this.mangoService.getRetrainDatasetInfo('fruit'),
    }).subscribe({
      next: ({ leaf, fruit }) => {
        if (leaf.success && leaf.data)   this.leafDatasetInfo  = leaf.data;
        if (fruit.success && fruit.data) this.fruitDatasetInfo = fruit.data;
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

  get leafCanRetrain(): boolean {
    return this.leafDatasetInfo?.can_retrain ?? false;
  }

  get fruitCanRetrain(): boolean {
    return this.fruitDatasetInfo?.can_retrain ?? false;
  }

  get leafEligibleCount(): number {
    return Object.keys(this.leafDatasetInfo?.eligible_classes ?? {}).length;
  }

  get fruitEligibleCount(): number {
    return Object.keys(this.fruitDatasetInfo?.eligible_classes ?? {}).length;
  }

  get minImagesPerClass(): number {
    return this.leafDatasetInfo?.min_images_per_class ?? this.fruitDatasetInfo?.min_images_per_class ?? 5;
  }
}
