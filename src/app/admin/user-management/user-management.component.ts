import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserManagementService, User, UserWithImages, UserStats } from '../../services/user-management.service';
import { DownloadService } from '../../services/download.service';
import { MangoImage } from '../../services/mango-disease.service';

interface UserFolder {
  user: User;
  expanded: boolean;
  loading: boolean;
  images: MangoImage[];
  imageStats?: {
    total: number;
    verified: number;
    unverified: number;
    healthy: number;
    diseased: number;
    leaf: number;
    fruit: number;
  };
}

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css'],
  standalone: false
})
export class UserManagementComponent implements OnInit {
  userFolders: UserFolder[] = [];
  loading = true;
  error: string | null = null;
  userStats: UserStats | null = null;
  
  // Filters
  searchTerm = '';
  filterStatus: 'all' | 'active' | 'inactive' = 'all';
  sortBy: 'name' | 'email' | 'images' | 'date' = 'images';
  imageTypeFilter: string = '';
  sortOrder: 'asc' | 'desc' = 'desc';
  locationFilter: string = '';
  statusFilter: string = '';
  registrationFilter: string = '';
  imageCountFilter: string = '';
  
  // Pagination
  currentPage = 1;
  pageSize = 20;
  totalUsers = 0;
  totalPages = 0;

  constructor(
    private userManagementService: UserManagementService,
    private downloadService: DownloadService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadUsers();
    this.loadUserStats();
  }

  async loadUsers() {
    try {
      this.loading = true;
      this.error = null;
      
      const filters: any = {
        page: this.currentPage,
        page_size: this.pageSize
      };
      
      if (this.searchTerm) {
        filters.search = this.searchTerm;
      }
      
      if (this.filterStatus !== 'all') {
        filters.is_active = this.filterStatus === 'active';
      }

      const response = await this.userManagementService.getUsers(filters).toPromise();
      
      if (response) {
        this.userFolders = response.users.map(user => ({
          user,
          expanded: false,
          loading: false,
          images: [],
          imageStats: undefined
        }));
        
        this.totalUsers = response.pagination.total_count;
        this.totalPages = response.pagination.total_pages;
        this.sortUsers();
      }
      
      this.loading = false;
    } catch (error) {
      console.error('Error loading users:', error);
      this.error = 'Failed to load users. Please try again.';
      this.loading = false;
    }
  }

  async loadUserStats() {
    try {
      const stats = await this.userManagementService.getUserStats().toPromise();
      this.userStats = stats || null;
    } catch (error) {
      console.error('Error loading user stats:', error);
      this.userStats = null;
    }
  }

  sortUsers() {
    this.userFolders.sort((a, b) => {
      switch (this.sortBy) {
        case 'name':
          const nameA = `${a.user.first_name} ${a.user.last_name}`.trim() || a.user.username;
          const nameB = `${b.user.first_name} ${b.user.last_name}`.trim() || b.user.username;
          return nameA.localeCompare(nameB);
        case 'email':
          return a.user.email.localeCompare(b.user.email);
        case 'images':
          return (b.user.total_images || 0) - (a.user.total_images || 0);
        case 'date':
          return new Date(b.user.date_joined).getTime() - new Date(a.user.date_joined).getTime();
        default:
          return 0;
      }
    });
  }

  getFilteredFolders(): UserFolder[] {
    let filtered = this.userFolders;

    // Apply search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(folder => {
        const fullName = `${folder.user.first_name} ${folder.user.last_name}`.toLowerCase();
        const locationDisplay = this.getUserLocationDisplay(folder.user).toLowerCase();
        return fullName.includes(term) ||
               folder.user.username.toLowerCase().includes(term) ||
               folder.user.email.toLowerCase().includes(term) ||
               locationDisplay.includes(term);
      });
    }

    // Apply status filter (from dropdown)
    if (this.statusFilter) {
      filtered = filtered.filter(folder => {
        if (this.statusFilter === 'active') {
          return folder.user.is_active;
        } else if (this.statusFilter === 'inactive') {
          return !folder.user.is_active;
        }
        return true;
      });
    }

    // Apply legacy status filter
    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(folder => {
        if (this.filterStatus === 'active') {
          return folder.user.is_active;
        } else {
          return !folder.user.is_active;
        }
      });
    }

    // Apply location filter
    if (this.locationFilter) {
      filtered = filtered.filter(folder => {
        if (this.locationFilter === 'with-location') {
          return folder.user.profile && (folder.user.profile.province || folder.user.profile.city);
        } else if (this.locationFilter === 'without-location') {
          return !folder.user.profile || (!folder.user.profile.province && !folder.user.profile.city);
        }
        return true;
      });
    }

    // Apply registration filter
    if (this.registrationFilter) {
      const now = new Date();
      filtered = filtered.filter(folder => {
        const joinDate = new Date(folder.user.date_joined);
        switch (this.registrationFilter) {
          case 'last-week':
            return joinDate > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          case 'last-month':
            return joinDate > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          case 'last-3-months':
            return joinDate > new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          default:
            return true;
        }
      });
    }

    // Apply image count filter
    if (this.imageCountFilter) {
      filtered = filtered.filter(folder => {
        const imageCount = folder.user.total_images || 0;
        switch (this.imageCountFilter) {
          case 'active':
            return imageCount >= 1;
          case 'very-active':
            return imageCount >= 5;
          case 'super-active':
            return imageCount >= 10;
          case 'no-images':
            return imageCount === 0;
          default:
            return true;
        }
      });
    }

    return filtered;
  }

  async toggleUserFolder(folder: UserFolder) {
    if (folder.expanded) {
      folder.expanded = false;
      return;
    }

    if (folder.images.length === 0 && !folder.loading) {
      await this.loadUserImages(folder);
    }
    
    folder.expanded = true;
  }

  async loadUserImages(folder: UserFolder) {
    try {
      folder.loading = true;
      const userWithImages = await this.userManagementService.getUserWithImages(folder.user.id).toPromise();
      
      if (userWithImages) {
        folder.images = userWithImages.images;
        folder.imageStats = userWithImages.imageStats;
      }
    } catch (error) {
      console.error('Error loading user images:', error);
      this.error = `Failed to load images for ${folder.user.username}`;
    } finally {
      folder.loading = false;
    }
  }

  onFilterChange() {
    this.currentPage = 1;
    this.loadUsers();
  }

  onSortChange() {
    this.sortUsers();
  }

  onSearchChange() {
    // Debounce search
    setTimeout(() => {
      this.onFilterChange();
    }, 300);
  }

  navigateToDashboard() {
    this.router.navigate(['/admin/dashboard']);
  }

  navigateToImageGallery(userId?: number) {
    if (userId) {
      this.router.navigate(['/admin/verified-images'], { queryParams: { user_id: userId } });
    } else {
      this.router.navigate(['/admin/verified-images']);
    }
  }

  viewImageDetails(imageId: number) {
    this.router.navigate(['/admin/image-detail', imageId]);
  }

  getUserDisplayName(user: User): string {
    const fullName = `${user.first_name} ${user.last_name}`.trim();
    return fullName || user.username;
  }

  getImageUrl(image: MangoImage): string {
    const baseUrl = 'http://127.0.0.1:8000';
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

  getDiseaseType(image: MangoImage): 'leaf' | 'fruit' | 'unknown' {
    if (image.model_used) {
      return image.model_used;
    }
    
    if (image.disease_type && image.disease_type !== 'unknown') {
      return image.disease_type;
    }
    
    const disease = image.disease_classification || image.predicted_class;
    if (!disease) return 'unknown';
    
    const diseaseLower = disease.toLowerCase();
    
    const leafDiseases = [
      'die back', 'dieback', 'anthracnose', 'powdery mildew', 'bacterial canker',
      'sooty mold', 'sooty mould', 'cutting weevil', 'gall midge'
    ];
    
    const fruitDiseases = [
      'black mould rot', 'stem end rot', 'alternaria'
    ];
    
    if (leafDiseases.some(leafDisease => diseaseLower.includes(leafDisease))) {
      return 'leaf';
    }
    
    if (fruitDiseases.some(fruitDisease => diseaseLower.includes(fruitDisease))) {
      return 'fruit';
    }
    
    return 'unknown';
  }

  getDiseaseTypeIcon(diseaseType: 'leaf' | 'fruit' | 'unknown'): string {
    switch (diseaseType) {
      case 'leaf': return '🍃';
      case 'fruit': return '🥭';
      default: return '❓';
    }
  }

  getDiseaseTypeClass(diseaseType: 'leaf' | 'fruit' | 'unknown'): string {
    switch (diseaseType) {
      case 'leaf': return 'bg-green-100 text-green-800';
      case 'fruit': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  // Computed properties for template
  getTotalImages(): number {
    return this.userStats?.total_images || this.userFolders.reduce((total, folder) => total + (folder.user.total_images || 0), 0);
  }

  getAverageImagesPerUser(): number {
    return this.userStats?.average_images_per_user || 0;
  }

  getLocationPercentage(): number {
    if (!this.userStats || this.userStats.total_users === 0) return 0;
    return Math.round((this.userStats.users_with_profiles / this.userStats.total_users) * 100);
  }

  getUserLocationDisplay(user: User): string {
    if (!user.profile) return '';
    
    const parts = [];
    if (user.profile.barangay) parts.push(user.profile.barangay);
    if (user.profile.city) parts.push(user.profile.city);
    if (user.profile.province) parts.push(user.profile.province);
    
    return parts.join(', ') || user.profile.full_address || '';
  }

  get filteredUserFolders(): UserFolder[] {
    return this.getFilteredFolders();
  }

  // Filter methods
  filterUsers() {
    // The filtering is handled by getFilteredFolders() method
  }

  // Utility methods for template
  getUserInitials(user: User): string {
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const username = user.username || '';
    
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    } else if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    } else if (username) {
      return username.substring(0, 2).toUpperCase();
    }
    return 'U';
  }

  getImageTypeClass(diseaseType: string): string {
    switch (diseaseType) {
      case 'fruit':
        return 'bg-orange-100 text-orange-800';
      case 'leaf':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  handleImageError(event: any) {
    console.warn('Image failed to load:', event.target.src);
    // event.target.src = 'assets/images/no-image-placeholder.png';
  }

  viewAllUserImages(user: User) {
    this.router.navigate(['/admin/verified-images'], { 
      queryParams: { user_id: user.id } 
    });
  }

  // Download methods
  async downloadImage(image: MangoImage) {
    try {
      const imageUrl = this.getImageUrl(image);
      await this.downloadService.downloadImageWithFetch(imageUrl, image.original_filename);
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Failed to download image. Please try again.');
    }
  }

  async downloadUserImages(user: User, folder: UserFolder) {
    try {
      if (folder.images.length === 0) {
        await this.loadUserImages(folder);
      }

      if (folder.images.length === 0) {
        alert('No images found for this user.');
        return;
      }

      const userName = this.getUserDisplayName(user);
      const filename = `${userName}_images.zip`;
      
      await this.downloadService.downloadUserImages(user.id, filename);
    } catch (error) {
      console.error('Error downloading user images:', error);
      alert('Failed to download user images. Please try again.');
    }
  }

  async toggleUserStatus(user: User, event: Event) {
    event.stopPropagation(); // Prevent folder expansion
    
    const action = user.is_active ? 'disable' : 'enable';
    const confirmed = confirm(`Are you sure you want to ${action} user "${this.getUserDisplayName(user)}"? This will ${user.is_active ? 'prevent them from logging in' : 'allow them to log in again'}.`);
    
    if (!confirmed) return;

    try {
      await this.userManagementService.updateUserStatus(user.id, !user.is_active).toPromise();
      
      // Update the user status in the local array
      user.is_active = !user.is_active;
      
      // Update user stats
      if (user.is_active) {
        this.userStats!.active_users++;
        this.userStats!.inactive_users--;
      } else {
        this.userStats!.active_users--;
        this.userStats!.inactive_users++;
      }
      
      // Show success message
      const statusText = user.is_active ? 'enabled' : 'disabled';
      alert(`User "${this.getUserDisplayName(user)}" has been ${statusText} successfully.`);
      
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Failed to update user status. Please try again.');
    }
  }
}
