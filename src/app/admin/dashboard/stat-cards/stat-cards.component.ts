import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-stat-cards',
  templateUrl: './stat-cards.component.html',
  standalone: false
})
export class StatCardsComponent {
  @Input() totalImages   = 0;
  @Input() healthyImages = 0;
  @Input() diseasedImages = 0;

  constructor(private router: Router) {}

  navigateToImageGallery(filter?: string) {
    if (filter) {
      this.router.navigate(['/admin/verified-images'], { queryParams: { filter } });
    } else {
      this.router.navigate(['/admin/verified-images']);
    }
  }
}
