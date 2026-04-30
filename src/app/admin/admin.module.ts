import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminRoutingModule } from './admin-routing.module';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ImageDetailComponent } from './image-detail/image-detail.component';
import { UploadImagesComponent } from './upload-images/upload-images.component';
import { ModelSettingsComponent } from './model-settings/model-settings.component';
import { VerifiedImagesComponent } from './verified-images/verified-images.component';
import { UserConfirmationsComponent } from './user-confirmations/user-confirmations.component';
import { VerifiedDiseasesComponent } from './verified-diseases/verified-diseases.component';
import { UserManagementComponent } from './user-management/user-management.component';
import { DiseaseMapComponent } from './disease-map/disease-map.component';
import { TrainingEditModalComponent } from './training-data/training-edit-modal/training-edit-modal.component';
import { TrainingSummaryComponent } from './training-data/training-summary.component';
import { DataTableComponent } from '../components/data-table/data-table.component';
import { FormModalComponent } from '../components/form-modal/form-modal.component';
import { ConfirmDialogComponent } from '../components/confirm-dialog/confirm-dialog.component';
import { SymptomsPageComponent } from './symptom-management/symptoms-page.component';
import { AliasesPageComponent } from './symptom-management/aliases-page.component';
import { DiseasesPageComponent } from './symptom-management/diseases-page.component';
import { DiseaseSymptomsPageComponent } from './symptom-management/disease-symptoms-page.component';

@NgModule({
  declarations: [
    DashboardComponent,
    ImageDetailComponent,
    // UploadImagesComponent,
    ModelSettingsComponent,
    VerifiedImagesComponent,
    UserConfirmationsComponent,
    VerifiedDiseasesComponent,
    UserManagementComponent,
    DiseaseMapComponent,
  
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule, 
    AdminRoutingModule,
    TrainingEditModalComponent,
    TrainingSummaryComponent,
    DataTableComponent,
    FormModalComponent,
    ConfirmDialogComponent,
    SymptomsPageComponent,
    AliasesPageComponent,
    DiseasesPageComponent,
    DiseaseSymptomsPageComponent
  ]
})
export class AdminModule { }