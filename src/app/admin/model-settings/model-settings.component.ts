import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MangoDiseaseService, MangoImage } from '../../services/mango-disease.service';


@Component({
  selector: 'app-model-settings',
  templateUrl: './model-settings.component.html',
  styleUrls: ['./model-settings.component.css'],
  standalone: false
})
export class ModelSettingsComponent implements OnInit {

  constructor(private router: Router, private mangoService: MangoDiseaseService) { }

  ngOnInit(): void {
  }

}