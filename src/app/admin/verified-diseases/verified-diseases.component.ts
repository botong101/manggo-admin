import { Component, OnInit } from '@angular/core';
import { MangoDiseaseService, MangoImage } from '../../services/mango-disease.service';

interface DiseaseGroup {
  disease: string;
  images: MangoImage[];
  count: number;
  expanded: boolean;
}

@Component({
  selector: 'app-verified-diseases',
  templateUrl: './verified-diseases.component.html',
  styleUrls: ['./verified-diseases.component.css'],
  standalone: false
})
export class VerifiedDiseasesComponent implements OnInit {
  
  ngOnInit() {
    
  }

  }
