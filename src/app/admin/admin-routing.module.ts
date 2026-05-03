import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ImageDetailComponent } from './image-detail/image-detail.component';
import { ModelSettingsComponent } from './model-settings/model-settings.component';
import { VerifiedImagesComponent } from './verified-images/verified-images.component';
import { UserConfirmationsComponent } from './user-confirmations/user-confirmations.component';
import { UserManagementComponent } from './user-management/user-management.component';
import { SymptomsPageComponent } from './symptom-management/symptoms-page.component';
import { AliasesPageComponent } from './symptom-management/aliases-page.component';
import { DiseasesPageComponent } from './symptom-management/diseases-page.component';
import { DiseaseSymptomsPageComponent } from './symptom-management/disease-symptoms-page.component';

const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'images', redirectTo: '/admin/verified-images', pathMatch: 'full' }, //redirect
  { path: 'image-gallery', redirectTo: '/admin/verified-images', pathMatch: 'full' }, //redirect
  { path: 'image-detail/:id', component: ImageDetailComponent },
  { path: 'verified-images', component: VerifiedImagesComponent },
  { path: 'user-management', component: UserManagementComponent },
  // { path: 'upload-images', component: UploadImagesComponent },
  { path: 'model-settings', component: ModelSettingsComponent },
  { path: 'user-confirmations', component: UserConfirmationsComponent },
  { path: 'symptoms',         component: SymptomsPageComponent },
  { path: 'symptom-aliases',  component: AliasesPageComponent },
  { path: 'diseases',         component: DiseasesPageComponent },
  { path: 'disease-symptoms', component: DiseaseSymptomsPageComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }