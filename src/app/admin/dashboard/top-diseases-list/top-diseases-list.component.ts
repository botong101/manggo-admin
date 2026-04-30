import { Component, Input } from '@angular/core';
import { TopDisease } from '../disease-trends/disease-trends.component';

@Component({
  selector: 'app-top-diseases-list',
  templateUrl: './top-diseases-list.component.html',
  standalone: false
})
export class TopDiseasesListComponent {
  @Input() diseases: TopDisease[] = [];
}
