import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DownloadService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  //download image from url
  downloadImageByUrl(imageUrl: string, filename: string): void {
    //make temp link
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    link.target = '_blank';
    
    //click and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  //download with fetch for cors 
  async downloadImageWithFetch(imageUrl: string, filename: string): Promise<void> {
    try {
      const response = await fetch(imageUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      //cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
      //try direct download if fetch fails
      this.downloadImageByUrl(imageUrl, filename);
    }
  }

  //download by id
  downloadImageById(imageId: number, filename: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/download-image/${imageId}/`, {
      responseType: 'blob'
    });
  }

  //download multiple as zip
  downloadImagesAsZip(imageIds: number[], zipFilename: string = 'images.zip'): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/download-images-zip/`, 
      { image_ids: imageIds },
      { responseType: 'blob' }
    );
  }

  //trigger download from blob
  handleBlobDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    //cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  //get filename from image object
  getImageFilename(image: any): string {
    if (image.original_filename) {
      return image.original_filename;
    }
    
    //try to get from url
    if (image.image_url || image.image) {
      const url = image.image_url || image.image;
      const urlParts = url.split('/');
      const filename = urlParts[urlParts.length - 1];
      
      //add .jpg if no extension
      if (!filename.includes('.')) {
        return `${filename}.jpg`;
      }
      
      return filename;
    }
    
    //default filename
    return `image_${image.id || Date.now()}.jpg`;
  }

  //make filename for bulk downloads
  generateBulkFilename(prefix: string = 'download', extension: string = 'zip'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `${prefix}_${timestamp}.${extension}`;
  }

  //download all user images as zip
  downloadUserImages(userId: number, username: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/download-user-images/${userId}/`, {
      responseType: 'blob'
    });
  }

  //download by disease type
  downloadImagesByDisease(diseaseType: string, diseaseName: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/download-disease-images/`, {
      params: { disease_type: diseaseType },
      responseType: 'blob'
    });
  }

  //download verified or unverified
  downloadImagesByVerification(isVerified: boolean): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/download-verification-images/`, {
      params: { is_verified: isVerified.toString() },
      responseType: 'blob'
    });
  }

  //check if url is valid
  isValidImageUrl(imageUrl: string): boolean {
    if (!imageUrl) return false;
    
    //check url format
    const urlPattern = /^(https?:\/\/)|(\/)/;
    return urlPattern.test(imageUrl);
  }

  //get image size
  getImageDimensions(imageUrl: string): Promise<{width: number, height: number}> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = imageUrl;
    });
  }
}
