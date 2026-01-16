import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserManagementService, User, UserWithImages, UserStats } from '../../services/user-management.service';
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
  
  // Pagination
  currentPage = 1;
  pageSize = 20;
  totalUsers = 0;
  totalPages = 0;

  constructor(
    private userManagementService: UserManagementService,
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

  getFilteredFolders(): UserFolder[] {
    let filtered = this.userFolders;

    //search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(folder => {
        const fullName = `${folder.user.first_name} ${folder.user.last_name}`.toLowerCase();
        return fullName.includes(term) ||
               folder.user.username.toLowerCase().includes(term) ||
               folder.user.email.toLowerCase().includes(term);
      });
    }

    //status filter
    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(folder => {
        if (this.filterStatus === 'active') {
          return folder.user.is_active;
        } else {
          return !folder.user.is_active;
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

  onSearchChange() {
    //debounce
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



  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  //computed stuff
  getAverageImagesPerUser(): number {
    return this.userStats?.average_images_per_user || 0;
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

  //filter stuff
  filterUsers() {
    //filtering done by getFilteredFolders()
  }

  //utility methods
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



  viewAllUserImages(user: User) {
    this.router.navigate(['/admin/verified-images'], { 
      queryParams: { user_id: user.id } 
    });
  }

  async toggleUserStatus(user: User, event: Event) {
    event.stopPropagation(); //prevent expand
    
    const action = user.is_active ? 'disable' : 'enable';
    const confirmed = confirm(`Are you sure you want to ${action} user "${this.getUserDisplayName(user)}"? This will ${user.is_active ? 'prevent them from logging in' : 'allow them to log in again'}.`);
    
    if (!confirmed) return;

    try {
      await this.userManagementService.updateUserStatus(user.id, !user.is_active).toPromise();
      
      //update local status
      user.is_active = !user.is_active;
      
      //update stats
      if (user.is_active) {
        this.userStats!.active_users++;
        this.userStats!.inactive_users--;
      } else {
        this.userStats!.active_users--;
        this.userStats!.inactive_users++;
      }
      
      //show msg
      const statusText = user.is_active ? 'enabled' : 'disabled';
      alert(`User "${this.getUserDisplayName(user)}" has been ${statusText} successfully.`);
      
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Failed to update user status. Please try again.');
    }
  }
}
