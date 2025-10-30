import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MangoDiseaseService, MangoImage } from '../../services/mango-disease.service';
import { VerifiedDiseaseFolder, MainFolder } from './images.interfaces';

@Injectable({
  providedIn: 'root'
})
export class ButtonsService{

    constructor(
        private mangoDiseaseService: MangoDiseaseService,
        private router: Router
    ) {}
    ///if image is already selected(checkboxed), remove it in selected array
    /// if image is not selected(unchecked-box), add it to selected array
    toggleImageSelection(
        imageId: number,
        currentSelection: Set<number>
    ): Set<number> {
        //creates new set from current selection for output
        const newSelection = new Set<number>();

        const existingIds = Array.from(currentSelection);
        for (let i= 0; i< existingIds.length; i++){
            newSelection.add(existingIds[i]);
        }

        let isAlreadySelected = false;
        const allids = Array.from(newSelection);

        for (let i = 0; i < allids.length; i++) {
            if (allids[i] === imageId) {
                isAlreadySelected = true;
                break;
            }
        }

        if(isAlreadySelected){
            newSelection.delete(imageId);
        }else{
            newSelection.add(imageId);
        }

        return newSelection;
    }

    selectAllInFolder(
        folder: VerifiedDiseaseFolder, 
        currentSelection: Set<number>
    ): Set<number> {
        const newSelection = new Set<number>();
        const existingIds = Array.from(currentSelection);

        for (let i= 0; i< existingIds.length; i++){
            newSelection.add(existingIds[i]);
        }
        
        //add all image from inside the initiated select all folder
        for (let i=0; i< folder.images.length; i++){
            const image = folder.images[i];
            newSelection.add(image.id);
        }
        return newSelection;
    }

    isAllInFolderSelected(
        folder: VerifiedDiseaseFolder,
        currentSelection: Set<number>
    ): boolean{ 
        if(folder.images.length === 0){
            return false;
        }

        for(let i=0; i<folder.images.length; i++){
            const image = folder.images[i]

            let isSelected = false;
            const selectedIds = Array.from(currentSelection);
            for(let j=0; j< selectedIds.length; j++){
                if(selectedIds[j] === image.id){
                    isSelected = true;
                    break;
                }
            }
            if(!isSelected){
                return false;
            }
        }
        return true;
    }

    selectAllImages(mainFolders: MainFolder[]): Set<number>{
        const allSelected = new Set<number>();

        for(let i=0; i< mainFolders.length; i++){
            const mainFolder = mainFolders[i];
            for(let j=0; j< mainFolder.subFolders.length; j++){
                const subFolder = mainFolder.subFolders[j];

                for(let k=0; k< subFolder.images.length; k++){
                    const image = subFolder.images[k];

                    allSelected.add(image.id);
                }
            }
        }
        return allSelected;
    }
    deselectAllImages(): Set<number>{
        return new Set<number>();
    }

    async verifySelectedImages(
        selectedIds: number[]
    ): Promise<{success: boolean; message: string}> {

        //first validation
        if (selectedIds.length === 0){
            return {
                success: false,
                message: 'No images selected. Select an Image to verify.'
            }
        }

        try {
            await firstValueFrom(
                this.mangoDiseaseService.bulkUpdateImages(selectedIds, {is_verified: true})
            );
            return {
                success: true,
                message: `Successfully verified ${selectedIds.length} images`
            };
        } catch (error) {
            // Step 4: Handle error
            console.error('Error verifying images:', error);
            return {
                success: false,
                message: 'Failed to verify images. Please try again.'
            };
        }
    }
    async unverifySelectedImages(
        selectedIds: number[]
    ): Promise<{ success: boolean; message: string }> {
    // Step 1: Validate input
        if (selectedIds.length === 0) {
        return {
            success: false,
            message: 'No images selected. Please select images to unverify.'
        };
        }
        
        try {
        // Step 2: Call backend API to unverify images
        await firstValueFrom(
            this.mangoDiseaseService.bulkUpdateImages(selectedIds, {is_verified: false})
        );
        
        // Step 3: Return success
        return {
            success: true,
            message: `Successfully unverified ${selectedIds.length} images`
        };
        
        } catch (error) {
        // Step 4: Handle error
        console.error('Error unverifying images:', error);
        return {
            success: false,
            message: 'Failed to unverify images. Please try again.'
        };
        }
    }
    async deleteSelectedImages(
        selectedIds: number []
    ): Promise<{success: boolean; message: string}> {
        if (selectedIds.length === 0) {
            return {
                success: false,
                message: 'No images selected. Select an Image to delete.'
            };
        }

        try {
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < selectedIds.length; i++) {
                const imageId = selectedIds[i];

                try {
                    await firstValueFrom(
                        this.mangoDiseaseService.deleteImage(imageId)
                    );
                    successCount++;
                } catch (error) {
                    console.error(`Error deleting image with ID ${imageId}:`, error);
                    failCount++;
                }
            }
            if (successCount > 0 && failCount === 0){
                return {
                    success: true,
                    message: `Successfully deleted ${successCount} images`
                }
            } else if (successCount > 0 && failCount > 0){
                return {
                    success: true,
                    message: `Deleted ${successCount} images, but failed to delete ${failCount} images`
                }
            }else{
                return{
                    success: false,
                    message: `Failed to delete all ${failCount} images.`
                }
            }
        } catch (error) {
            console.error('Error deleting images:', error);
            return {
                success: false,
                message: 'Failed to delete images. Please try again.'
            };
        }
    }
    viewImageDetails(imageId: number): void {
        this.router.navigate(['/admin/verified-images', imageId]);
    }

    isImageSelected(imageId: number, currentSelection: Set<number>): boolean {
    // Check if image ID exists in selection Set
        const selectedIds = Array.from(currentSelection);
        for (let i = 0; i < selectedIds.length; i++) {
            if (selectedIds[i] === imageId) {
                return true;
            }
        }
        return false;
    }
    getSelectedCount(currentSelection: Set<number>): number {
        return currentSelection.size;
    }
    getSelectedIds(currentSelection: Set<number>): number[] {
        const selectedIds: number[] = [];
        const ids = Array.from(currentSelection);
        for (let i = 0; i < ids.length; i++) {
            selectedIds.push(ids[i]);
        }
        return selectedIds;
    }


    hasSelectedImages(currentSelection: Set<number>): boolean {
        return currentSelection.size > 0;
    }

    /**
     * Get all images from main folders (helper for other operations)
     */
    getAllImagesFromFolders(mainFolders: MainFolder[]): MangoImage[] {
        // Step 1: Create empty array to store all images
        const allImages: MangoImage[] = [];
        
        // Step 2: Loop through each main folder
        for (let i = 0; i < mainFolders.length; i++) {
        const mainFolder = mainFolders[i];
        
        // Step 3: Loop through each sub folder
        for (let j = 0; j < mainFolder.subFolders.length; j++) {
            const subFolder = mainFolder.subFolders[j];
            
            // Step 4: Loop through each image
            for (let k = 0; k < subFolder.images.length; k++) {
                const image = subFolder.images[k];
                
                // Step 5: Check if image already exists in array
                let alreadyExists = false;
                for (let m = 0; m < allImages.length; m++) {
                    if (allImages[m].id === image.id) {
                        
                    break;
                    }
                }
                
                // Step 6: Add image if not duplicate
                if (!alreadyExists) {
                    allImages.push(image);
                }
            }
        }
        }
        
        return allImages;
    }
}