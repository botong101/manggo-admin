import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MangoDiseaseService, MangoImage } from '../../services/mango-disease.service';
import { DownloadService } from '../../services/download.service';
import { AuthService } from '../../services/auth.service';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { VerifiedDiseaseFolder, MainFolder } from './images.interfaces';
import { FilterService} from './Filter.service';
import { environment } from '../../../environments/environment';
import { ButtonsService } from './buttons.service';


@Component({
  selector: 'app-verified-images',
  templateUrl: './verified-images.component.html',
  styleUrls: ['./verified-images.component.css'],
  standalone: false
})

export class VerifiedImagesComponent implements OnInit {

  mainFolders: MainFolder[] = [];
  diseaseFolders: VerifiedDiseaseFolder[] = [];
  loading = true;
  error: string | null = null;

  totalVerifiedCount = 0;
  totalUnverifiedCount = 0;
  totalUnknownCount = 0;
  totalAllCount = 0;

  selectedImages: Set<number> = new Set();

  downloadingAll = false;
  updatingSelected = false;
  
  // Confidence threshold for unknown images
  private readonly UNKNOWN_CONFIDENCE_THRESHOLD = 50; // Images below 50% confidence are considered unknown
  
  // Filter options
  filterType: 'all' | 'leaf' | 'fruit' = 'all';
  searchTerm = '';
  sortBy: 'disease' | 'count' | 'date' = 'disease';
  dateRange: 'all' | 'week' | 'month' | 'year' = 'all';

  constructor(
    private mangoDiseaseService: MangoDiseaseService,
    private downloadService: DownloadService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private filterService: FilterService,
    private buttonsService: ButtonsService
  ) {}

  ngOnInit() {
    this.loadAllImages();
  }

  async loadAllImages() {
    try {
      // Step 1: Show loading state to user
      this.loading = true;
      this.error = null;

      // Step 2: Generate timestamp to prevent browser caching
      // This ensures we always get fresh data from the server
      const timestamp = new Date().getTime();
      
      // Step 3: Fetch all images from the backend API
      // We request 5000 images per page (a large number to get all images)
      const response = await firstValueFrom(
        this.mangoDiseaseService.getClassifiedImages({
          _t: timestamp  // Cache-busting parameter
        }),
      );

      // Step 4: Check if we received valid data
      if (!response || !response.images) {
        this.error = 'No images found';
        this.loading = false;
        return;
      }

      // Step 5: Get all images from the response
      const allImages = response.images;
      this.totalAllCount = allImages.length;
      
      // Step 6: Create empty arrays to categorize images
      const verifiedImages: MangoImage[] = [];
      const unverifiedImages: MangoImage[] = [];
      const unknownImages: MangoImage[] = [];
      
      // Step 7: Loop through each image and categorize it
      // We check confidence score and verification status
      for (let i = 0; i < allImages.length; i++) {
        const image = allImages[i];
        const confidence = this.getConfidenceScore(image);
        
        // Check if image has low confidence (below 50%)
        if (confidence < this.UNKNOWN_CONFIDENCE_THRESHOLD) {
          // This is an unknown/low confidence image
          unknownImages.push(image);
        } else {
          // This is a known/high confidence image
          // Now check if it's verified or not
          if (image.is_verified === true) {
            verifiedImages.push(image);
          } else {
            unverifiedImages.push(image);
          }
        }
      }
      
      // Step 8: Update the count totals
      this.totalVerifiedCount = verifiedImages.length;
      this.totalUnverifiedCount = unverifiedImages.length;
      this.totalUnknownCount = unknownImages.length;
      
      // Step 9: Create the folder structure for display
      this.createMainFolders(allImages, verifiedImages, unverifiedImages, unknownImages);
      
      // Step 10: Force Angular to update the UI
      this.cdr.detectChanges();
      
      // Step 11: Hide loading state
      this.loading = false;

    } catch (error) {
      console.error('Error loading images:', error);
      
      // Handle authentication errors (user not logged in)
      if (error && (error as any).status === 401) {
        this.authService.logout(); // Clear stored tokens
        this.router.navigate(['/login']); // Redirect to login page
        return;
      }
      
      // Show error message to user
      this.error = 'Failed to load images. Please try again.';
      this.loading = false;
    }
  }

  createMainFolders(allImages: MangoImage[], verifiedImages: MangoImage[], unverifiedImages: MangoImage[], unknownImages: MangoImage[]) {
    const allSubFolders = this.groupImagesByDisease(allImages, 'all');
    const verifiedSubFolders = this.groupImagesByDisease(verifiedImages, 'verified');
    const unverifiedSubFolders = this.groupImagesByDisease(unverifiedImages, 'unverified');
    const unknownSubFolders = this.groupImagesByDisease(unknownImages, 'unknown');
    
    this.mainFolders = [
      {
        name: 'All Images',
        count: allImages.length,
        expanded: false,
        type: 'all',
        subFolders: [...allSubFolders], // Copy for filtering
        originalSubFolders: allSubFolders // Original data
      },
      {
        name: 'Verified Images',
        count: verifiedImages.length,
        expanded: false,
        type: 'verified',
        subFolders: [...verifiedSubFolders], // Copy for filtering
        originalSubFolders: verifiedSubFolders // Original data
      },
      {
        name: 'Unverified Images',
        count: unverifiedImages.length,
        expanded: false,
        type: 'unverified',
        subFolders: [...unverifiedSubFolders], // Copy for filtering
        originalSubFolders: unverifiedSubFolders // Original data
      },
      {
        name: 'Unknown Images',
        count: unknownImages.length,
        expanded: false,
        type: 'unknown',
        subFolders: [...unknownSubFolders], // Copy for filtering
        originalSubFolders: unknownSubFolders // Original data
      }
    ];
    
    // For backward compatibility, also populate the old diseaseFolders array with all images
    this.diseaseFolders = this.mainFolders[0].subFolders;
  }

  groupImagesByDisease(images: MangoImage[], verificationStatus: 'all' | 'verified' | 'unverified' | 'unknown'): VerifiedDiseaseFolder[] {
    const diseaseMap = new Map<string, MangoImage[]>();

    // Filter by date range if specified
    let filteredImages = images;
    if (this.dateRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (this.dateRange) {
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      filteredImages = images.filter(img => 
        new Date(img.uploaded_at) >= cutoffDate
      );
    }

    filteredImages.forEach(image => {
      const disease = image.predicted_class || 'Unknown';
      const diseaseType = this.getDiseaseType(image);
      
      // Create a unique key that combines disease name and type
      const folderKey = `${disease}_${diseaseType}`;
      
      if (!diseaseMap.has(folderKey)) {
        diseaseMap.set(folderKey, []);
      }
      diseaseMap.get(folderKey)!.push(image);
    });

    const folders = Array.from(diseaseMap.entries()).map(([folderKey, imgs]) => {
      const disease = imgs[0].predicted_class || 'Unknown';
      const diseaseType = this.getDiseaseType(imgs[0]);
      
      // Create display name with type suffix for clarity
      const displayName = diseaseType !== 'unknown' ? 
        `${disease} (${diseaseType.charAt(0).toUpperCase() + diseaseType.slice(1)})` : 
        disease;
      
      return {
        disease: displayName,
        count: imgs.length,
        images: imgs.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()),
        expanded: false,
        diseaseType: diseaseType,
        downloading: false,
        verificationStatus
      };
    });

    // Sort folders
    folders.sort((a, b) => {
      switch (this.sortBy) {
        case 'count':
          return b.count - a.count;
        case 'disease':
          return a.disease.localeCompare(b.disease);
        case 'date':
          return new Date(b.images[0]?.uploaded_at || '').getTime() - 
                 new Date(a.images[0]?.uploaded_at || '').getTime();
        default:
          return 0;
      }
    });

    return folders;
  }

  sortFolders() {
    // Update all main folders
    this.mainFolders.forEach(mainFolder => {
      mainFolder.subFolders.sort((a, b) => {
        switch (this.sortBy) {
          case 'count':
            return b.count - a.count;
          case 'disease':
            return a.disease.localeCompare(b.disease);
          case 'date':
            return new Date(b.images[0]?.uploaded_at || '').getTime() - 
                   new Date(a.images[0]?.uploaded_at || '').getTime();
          default:
            return 0;
        }
      });
    });
    
    // Update the main diseaseFolders array for backward compatibility
    if (this.mainFolders.length > 0) {
      this.diseaseFolders = this.mainFolders[0].subFolders;
    }
  }

  toggleFolder(folder: VerifiedDiseaseFolder) {
    folder.expanded = !folder.expanded;
  }

  toggleMainFolder(mainFolder: MainFolder) {
    mainFolder.expanded = !mainFolder.expanded;
    this.cdr.detectChanges();
  }
  // Download functionality
  async downloadFolderImages(folder: VerifiedDiseaseFolder) {
    try {
      folder.downloading = true;
      
      // Check if there are unverified images in this folder
      const unverifiedImages = folder.images.filter(img => !img.is_verified);
      
      if (unverifiedImages.length > 0) {
        const confirmDownload = confirm(
          `This folder contains ${unverifiedImages.length} unverified image(s). ` +
          `These will be downloaded with "unverified" appended to their filenames. ` +
          `Do you want to continue?`
        );
        
        if (!confirmDownload) {
          folder.downloading = false;
          return; // User cancelled the download
        }
      }
      
      const zip = new JSZip();
      const diseaseType = folder.diseaseType;
      const folderName = `${folder.disease} (${diseaseType})`;
      const diseaseFolder = zip.folder(folderName);

      if (!diseaseFolder) {
        throw new Error('Failed to create folder in ZIP');
      }

      // Download each image and add to ZIP
      for (const image of folder.images) {
        try {
          const imageUrl = this.getImageUrl(image);
          const response = await fetch(imageUrl);
          
          if (!response.ok) {
            console.warn(`Failed to download image: ${image.original_filename}`);
            continue;
          }

          const blob = await response.blob();
          let filename = image.original_filename || `image_${image.id}.jpg`;
          
          // Append "unverified" to filename if image is not verified
          if (!image.is_verified) {
            const fileExtension = filename.substring(filename.lastIndexOf('.'));
            const baseName = filename.substring(0, filename.lastIndexOf('.'));
            filename = `${baseName}_unverified${fileExtension}`;
          }
          
          diseaseFolder.file(filename, blob);
        } catch (error) {
          console.error(`Error downloading image ${image.id}:`, error);
        }
      }

      // Generate and download ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      const timestamp = new Date().toISOString().split('T')[0];
      const zipFilename = `${folder.disease}_${diseaseType}_images_${timestamp}.zip`;
      
      saveAs(content, zipFilename);
      
    } catch (error) {
      console.error('Error creating ZIP file:', error);
      this.error = 'Failed to download images. Please try again.';
    } finally {
      folder.downloading = false;
    }
  }

  async downloadAllVerifiedImages() {
    try {
      this.downloadingAll = true;
      const zip = new JSZip();

      // Get unique images from currently visible main folders to avoid duplicates
      const uniqueImagesMap = new Map<number, MangoImage>();
      this.getFilteredMainFolders().forEach(mainFolder => {
        mainFolder.subFolders.forEach(subFolder => {
          subFolder.images.forEach(image => {
            uniqueImagesMap.set(image.id, image);
          });
        });
      });

      const allImages = Array.from(uniqueImagesMap.values());

      // Check if there are unverified images
      const unverifiedImages = allImages.filter(img => !img.is_verified);
      
      if (unverifiedImages.length > 0) {
        const confirmDownload = confirm(
          `Your download includes ${unverifiedImages.length} unverified image(s). ` +
          `These will be downloaded with "unverified" appended to their filenames. ` +
          `Do you want to continue?`
        );
        
        if (!confirmDownload) {
          this.downloadingAll = false;
          return; // User cancelled the download
        }
      }

      // Group images by disease for folder structure
      const diseaseMap = new Map<string, MangoImage[]>();
      allImages.forEach(image => {
        const disease = image.predicted_class || 'Unknown';
        const diseaseType = this.getDiseaseType(image);
        const folderName = `${disease} (${diseaseType})`;
        
        if (!diseaseMap.has(folderName)) {
          diseaseMap.set(folderName, []);
        }
        diseaseMap.get(folderName)!.push(image);
      });


      // Create folders for each disease with type
      for (const [folderName, images] of diseaseMap.entries()) {
        const diseaseFolder = zip.folder(folderName);
        
        if (!diseaseFolder) {
          console.error(`Failed to create folder for disease: ${folderName}`);
          continue;
        }

        for (const image of images) {
          try {
            const imageUrl = this.getImageUrl(image);
            const response = await fetch(imageUrl);
            
            if (!response.ok) {
              console.warn(`Failed to download image ${image.id}: ${response.statusText}`);
              continue;
            }

            const blob = await response.blob();
            let filename = image.original_filename || `image_${image.id}.jpg`;
            
            // Append "unverified" to filename if image is not verified
            if (!image.is_verified) {
              const fileExtension = filename.substring(filename.lastIndexOf('.'));
              const baseName = filename.substring(0, filename.lastIndexOf('.'));
              filename = `${baseName}_unverified${fileExtension}`;
            }
            
            diseaseFolder.file(filename, blob);
          } catch (error) {
            console.error(`Error downloading image ${image.id}:`, error);
          }
        }
      }

      // Generate and download ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      const timestamp = new Date().toISOString().split('T')[0];
      const zipFilename = `all_images_${timestamp}.zip`;
      
      saveAs(content, zipFilename);
      
    } catch (error) {
      this.error = 'Failed to download all images. Please try again.';
    } finally {
      this.downloadingAll = false;
    }
  }

  async downloadSelectedImages() {
    if (this.selectedImages.size === 0) return;

    try {
      const zip = new JSZip();

      // Get unique images from selected IDs to avoid duplicates
      // Use a Map to ensure uniqueness by image ID
      const uniqueImagesMap = new Map<number, MangoImage>();
      
      this.mainFolders.forEach(mainFolder => {
        mainFolder.subFolders.forEach(subFolder => {
          subFolder.images.forEach(image => {
            if (this.selectedImages.has(image.id)) {
              uniqueImagesMap.set(image.id, image);
            }
          });
        });
      });

      const selectedImageData = Array.from(uniqueImagesMap.values());
      
      
      // Check if there are unverified images in the selection
      const unverifiedImages = selectedImageData.filter(img => !img.is_verified);
      
      if (unverifiedImages.length > 0) {
        const confirmDownload = confirm(
          `Your selection includes ${unverifiedImages.length} unverified image(s). ` +
          `These will be downloaded with "unverified" appended to their filenames. ` +
          `Do you want to continue?`
        );
        
        if (!confirmDownload) {
          return; // User cancelled the download
        }
      }

      // Group images by disease for folder structure
      const diseaseMap = new Map<string, MangoImage[]>();
      selectedImageData.forEach(image => {
        const disease = image.predicted_class || 'Unknown';
        const diseaseType = this.getDiseaseType(image);
        const folderName = `${disease} (${diseaseType})`;
        
        if (!diseaseMap.has(folderName)) {
          diseaseMap.set(folderName, []);
        }
        diseaseMap.get(folderName)!.push(image);
      });


      // Create folders for each disease and download images
      for (const [folderName, images] of diseaseMap.entries()) {
        const diseaseFolder = zip.folder(folderName);
        
        if (!diseaseFolder) {
          console.error(`Failed to create folder for disease: ${folderName}`);
          continue;
        }


        for (const image of images) {
          try {
            const imageUrl = this.getImageUrl(image);
            
            const response = await fetch(imageUrl);
            
            if (!response.ok) {
              console.warn(`Failed to download image ${image.id}: ${response.statusText}`);
              continue;
            }

            const blob = await response.blob();
            let filename = image.original_filename || `image_${image.id}.jpg`;
            
            // Append "unverified" to filename if image is not verified
            if (!image.is_verified) {
              const fileExtension = filename.substring(filename.lastIndexOf('.'));
              const baseName = filename.substring(0, filename.lastIndexOf('.'));
              filename = `${baseName}_unverified${fileExtension}`;
            }
            
            diseaseFolder.file(filename, blob);
          } catch (error) {
            console.error(`Error downloading image ${image.id}:`, error);
          }
        }
      }

      // Generate and download ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      const timestamp = new Date().toISOString().split('T')[0];
      const zipFilename = `selected_images_${timestamp}.zip`;
      
      saveAs(content, zipFilename);
      
    } catch (error) {
      this.error = 'Failed to download selected images. Please try again.';
    }
  }

  

  deselectAllInFolder(folder: VerifiedDiseaseFolder) {
    folder.images.forEach(image => {
      this.selectedImages.delete(image.id);
    });
  }

  getImageUrl(image: MangoImage): string {
    const baseUrl = environment.apiUrl; // Use environment config
    const originalUrl = image.image_url || image.image;
    
    if (!originalUrl) {
      return `${baseUrl}/api/media/mango_images/${image.original_filename}`;
    }
    
    if (originalUrl.startsWith('http')) {
      return originalUrl;
    }
    
    // Use custom media endpoint
    let filePath = '';
    if (originalUrl.startsWith('/media/')) {
      filePath = originalUrl.substring(7);
    } else if (originalUrl.startsWith('media/')) {
      filePath = originalUrl.substring(6);
    } else if (originalUrl.includes('mango_images/')) {
      const mangoIndex = originalUrl.indexOf('mango_images/');
      filePath = originalUrl.substring(mangoIndex);
    } else {
      filePath = originalUrl.startsWith('/') ? originalUrl.substring(1) : originalUrl;
    }
    
    return `${baseUrl}/api/media/${filePath}`;
  }

  
  getDiseaseTypeClass(diseaseType: 'leaf' | 'fruit' | 'unknown' | undefined): string {
    if (!diseaseType || diseaseType === 'unknown') return 'text-orange-600'; // Default color for mango/unknown
    return diseaseType === 'leaf' ? 'text-green-600' : 'text-orange-600';
  }

  // Get disease type - use the disease_type field from the API
  getDiseaseType(image: MangoImage): 'leaf' | 'fruit' | 'unknown' {
    
    // Use the disease_type field from the backend API (most reliable)
    if (image.disease_type && image.disease_type !== 'unknown') {
      return image.disease_type;
    }
    
    // Fallback to model_used if available
    if (image.model_used) {
      return image.model_used;
    }
    
    // If neither field is available, return unknown
    return 'unknown';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  getDownloadProgress(folder: VerifiedDiseaseFolder): string {
    return folder.downloading ? 'Preparing download...' : '';
  }

  onSortChange() {
    this.sortFolders();
    this.cdr.detectChanges();
  }

  onDateRangeChange() {
    this.loadAllImages();
  }

  // Individual image download using DownloadService
  async downloadImage(image: MangoImage) {
    try {
      const imageUrl = this.getImageUrl(image);
      await this.downloadService.downloadImageWithFetch(imageUrl, image.original_filename);
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Failed to download image. Please try again.');
    }
  }

  // Helper method to get confidence score with proper formatting
  getConfidenceScore(image: MangoImage): number {
    if (image.confidence_score) {
      // If confidence_score is between 0 and 1, convert to percentage
      if (image.confidence_score <= 1) {
        return image.confidence_score * 100;
      }
      // If already a percentage, return as is
      return image.confidence_score;
    }
    return 0;
  }

  


  //FILTER LOGICS
  onFilterChange() {
    // Force update of filtered data
    this.getFilteredMainFolders();
    // Trigger change detection to update filtered results
    this.cdr.detectChanges();
  }
  getFilteredMainFolders(): MainFolder[] {
    return this.filterService.filterMainFolders(
      this.mainFolders,
      this.filterType,
      this.searchTerm,
      this.sortBy,
      this.dateRange
    );
  }
  filterSubFolders(subFolders: VerifiedDiseaseFolder[]): VerifiedDiseaseFolder[] {
    return this.filterService.filterSubFolders(
      subFolders,
      this.filterType,
      this.searchTerm,
      this.dateRange
    )
  }
  
  applySorting(folders: VerifiedDiseaseFolder[]): VerifiedDiseaseFolder[] {
    return this.filterService.applySorting(folders, this.sortBy);
  }

  hasActiveFilters(): boolean {
    return this.filterService.hasActiveFilters(
      this.filterType,
      this.searchTerm,
      this.dateRange
    );
  }

  clearAllFilters(): void {
    this.filterType = 'all';
    this.searchTerm = '';
    this.dateRange = 'all';
    this.sortBy = 'disease';
    
    // Force update of filtered data
    this.getFilteredMainFolders();
    this.cdr.detectChanges();
  }

  getFilteredTotals() {
    const filteredFolders = this.getFilteredMainFolders();
    const totals = this.filterService.getFilteredTotal(filteredFolders);

    return {
      ...totals,
      isFiltered: this.hasActiveFilters()
    };
  }





  // BUTTON ACTIONS

  toggleImageSelection(imageId: number): void{
    this.selectedImages = this.buttonsService.toggleImageSelection(imageId, this.selectedImages);
  }

  selectAllInFolder(folder: VerifiedDiseaseFolder): void{
    this.selectedImages = this.buttonsService.selectAllInFolder(folder, this.selectedImages);
  }
  // Helper method to check if all images in a folder are selected
  isAllInFolderSelected(folder: VerifiedDiseaseFolder): boolean {
    return this.buttonsService.isAllInFolderSelected(folder, this.selectedImages);
  }
  selectAllImages(): void{
    this.selectedImages = this.buttonsService.selectAllImages(this.mainFolders);
  }
  deselectAllImages() {
    this.selectedImages = this.buttonsService.deselectAllImages();
  }


  //verify button
  async verifySelectedImages(): Promise<void> {
    if (this.selectedImages.size === 0) {
      alert('Please select images to verify');
      return;
    }

    const confirmMessage = `Are you sure you want to verify ${this.selectedImages.size} images?`;
    if (!confirm(confirmMessage)) {
      return;
    }

    this.updatingSelected = true;

    try {
      const selectedIds = this.buttonsService.getSelectedIds(this.selectedImages);
      const result = await this.buttonsService.verifySelectedImages(selectedIds);

      alert(result.message);

      if (result.success) {
        this.selectedImages = this.buttonsService.deselectAllImages();
        await this.loadAllImages();
      }

    } finally {
      this.updatingSelected = false;
    }
  }



  //unverify button
  async unverifySelectedImages(): Promise<void> {
    if (this.selectedImages.size === 0) {
      alert('Please select images to unverify');
      return;
    }

    const confirmMessage = `Are you sure you want to unverify ${this.selectedImages.size} images?`;
    if (!confirm(confirmMessage)) {
      return;
    }

    this.updatingSelected = true;

    try {
      const selectedIds = this.buttonsService.getSelectedIds(this.selectedImages);
      const result = await this.buttonsService.unverifySelectedImages(selectedIds);

      alert(result.message);

      if (result.success) {
        this.selectedImages = this.buttonsService.deselectAllImages();
        await this.loadAllImages();
      }

    } finally {
      this.updatingSelected = false;
    }
  }

  //delete button
  async deleteSelectedImages(): Promise<void> {
    if (this.selectedImages.size === 0) {
      alert('Please select images to delete');
      return;
    }

    const confirmMessage = `⚠️ WARNING: Are you sure you want to DELETE ${this.selectedImages.size} images?\n\nThis action CANNOT be undone!`;
    if (!confirm(confirmMessage)) {
      return;
    }

    const doubleConfirm = confirm('Are you ABSOLUTELY sure? This will permanently delete the images.');
    if (!doubleConfirm) {
      return;
    }

    this.updatingSelected = true;

    try {
      const selectedIds = this.buttonsService.getSelectedIds(this.selectedImages);
      const result = await this.buttonsService.deleteSelectedImages(selectedIds);

      alert(result.message);

      if (result.success) {
        this.selectedImages = this.buttonsService.deselectAllImages();
        await this.loadAllImages();
      }

    } finally {
      this.updatingSelected = false;
    }
  }



  viewImageDetails(imageId: number) {
    this.router.navigate(['/admin/image-detail', imageId]);
  }
  isImageSelected(imageId: number): boolean {
    return this.buttonsService.isImageSelected(imageId, this.selectedImages);
  }
  getSelectedCount(): number {
    return this.buttonsService.getSelectedCount(this.selectedImages);
  }
  hasSelectedImages(): boolean {
    return this.buttonsService.hasSelectedImages(this.selectedImages);
  }
}
