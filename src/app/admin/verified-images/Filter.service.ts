import { Injectable } from '@angular/core';
import { MangoImage } from '../../services/mango-disease.service';
import { VerifiedDiseaseFolder, MainFolder } from './images.interfaces';

@Injectable({
    providedIn: 'root',
})
export class FilterService {
    filterMainFolders(
        mainFolders: MainFolder[],
        filterType: 'all' | 'leaf' | 'fruit',
        searchTerm: string,
        sortBy: 'disease' | 'count' | 'date',
        dateRange: 'all' | 'week' | 'month' | 'year'
    ):MainFolder[]{
        if (!mainFolders || mainFolders.length === 0) {
            return [];
        }

        for(let i=0; i<mainFolders.length; i++){
            const mainFolder = mainFolders[i];

            const originalSubFolders = mainFolder.originalSubFolders;

            const filteredSubFolders = this.filterSubFolders(
                originalSubFolders,
                filterType,
                searchTerm,
                dateRange    
            )
            
            const sortedSubFolders = this.applySorting(filteredSubFolders, sortBy);

            let totalImages = 0;
            for(let j=0; j < sortedSubFolders.length; j++){
                const folder = sortedSubFolders[j];
                totalImages += folder.count;
            }

            mainFolder.count = totalImages;
            mainFolder.subFolders = sortedSubFolders;
        }
        return mainFolders;
    }

    filterSubFolders(
        subFolders: VerifiedDiseaseFolder[],
        filterType: 'all' | 'leaf' | 'fruit',
        searchTerm: string,
        dateRange: 'all' | 'week' | 'month' | 'year'
    ): VerifiedDiseaseFolder[] {
        let filtered = subFolders;

        if (filterType !== 'all') {
            filtered = filtered.filter(folder => folder.diseaseType === filterType);
        }
        if(searchTerm){
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(folder => 
                folder.disease.toLowerCase().includes(term)
            );
        }
        if(dateRange !== 'all'){
            filtered = this.applyDateFilter(filtered, dateRange);
        }

        return filtered;
    }

    applyDateFilter(
        folders: VerifiedDiseaseFolder[],
        dateRange: 'all' | 'week' | 'month' | 'year'
    ):VerifiedDiseaseFolder[]{
        if(dateRange === 'all'){
            return folders;
        }
        const now = new Date();
        const cutoffDate = new Date();

        switch(dateRange){
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

        return folders.map(folder =>{
            const filteredImages = folder.images.filter(images =>{
                new Date(images.uploaded_at) >= cutoffDate;
            })
            return {
                ...folder,
                images: filteredImages,
                count: filteredImages.length

            };
        }).filter(folder => folder.images.length > 0); // para mo return only none 0 disease folder
    }

    applySorting(
        folders: VerifiedDiseaseFolder[],
        sortBy: 'disease' | 'count' | 'date'
    ): VerifiedDiseaseFolder[]{
        const sorted = [...folders];

        switch(sortBy){
            case 'disease':
                return sorted.sort((a, b) => a.disease.localeCompare(b.disease));
                
            case 'count':
                return sorted.sort((a, b) => b.count - a.count);
            case 'date':
                return sorted.sort((a, b) => {
                    const dateA = new Date( a.images[0]?.uploaded_at || '');
                    const dateB = new Date( b.images[0]?.uploaded_at || '');
                    return new Date(dateB).getTime() - new Date(dateA).getTime();
                });
            default:
                return sorted;
        }
    }

    hasActiveFilters(
        filterType: 'all' | 'leaf' | 'fruit',
        searchTerm: string,
        dateRange: 'all' | 'week' | 'month' | 'year'
    ): boolean {
        return filterType !== 'all' || 
            searchTerm.trim() !== '' || 
            dateRange !== 'all';
    }
    
    getFilteredTotal(filteredFolders: MainFolder[]){
        const allImagesFolder = filteredFolders.find(f => f.type === 'all');
        const verifiedFolder = filteredFolders.find(f => f.type === 'verified');
        const unverifiedFolder = filteredFolders.find(f => f.type === 'unverified');
        const unknownFolder = filteredFolders.find(f => f.type === 'unknown');

        return{
            total: allImagesFolder?.count || 0,
            verified: verifiedFolder?.count || 0,
            unverified: unverifiedFolder?.count || 0,
            unknown: unknownFolder?.count || 0,
        };
    }
}