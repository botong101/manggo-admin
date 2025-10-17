import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MangoDiseaseService } from '../../services/mango-disease.service';
import { LocationService, LocationData } from '../../services/location.service';
import { Subscription } from 'rxjs';

interface UploadImage {
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  error: string | null;
  result?: any;
  location?: LocationData;
}

@Component({
  selector: 'app-upload-images',
  templateUrl: './upload-images.component.html',
  styleUrls: ['./upload-images.component.css'],
  standalone: false
})
export class UploadImagesComponent implements OnInit, OnDestroy {
  

  ngOnInit(): void {
  }

  ngOnDestroy() {
    if (this.locationSubscription) {
      this.locationSubscription.unsubscribe();
    }
  }
  private locationSubscription: Subscription | null = null;


}