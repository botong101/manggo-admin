import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from './services/auth.service';
import { NotificationService } from './services/notification.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: false
})
export class AppComponent implements OnInit {
  title = 'MangoSense-masterUI';
  isAuthenticated = false;
  showNavigation = false;
  isMenuOpen = false;
  showNotificationPanel = false;
  unreadNotificationCount = 0;
  currentUser: any = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    //check if logged in
    this.authService.isAuthenticated$.subscribe(
      isAuth => {
        this.isAuthenticated = isAuth;
        this.updateNavigationVisibility();
        
        //load notifs when logged in
        if (isAuth) {
          this.notificationService.loadNotifications();
        }
      }
    );

    //get current user
    this.authService.currentUser$.subscribe(
      user => {
        this.currentUser = user;
      }
    );

    //get notif count
    this.notificationService.unreadCount$.subscribe(
      count => {
        this.unreadNotificationCount = count;
      }
    );

    //watch route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateNavigationVisibility();
    });

    //check auth on load
    this.isAuthenticated = this.authService.isLoggedIn();
    this.currentUser = this.authService.getCurrentUser();
    this.updateNavigationVisibility();
    
    //load notifs if already logged in
    if (this.isAuthenticated) {
      this.notificationService.loadNotifications();
    }
  }

  updateNavigationVisibility() {
    //show nav when logged in and not on login page
    this.showNavigation = this.isAuthenticated && !this.router.url.includes('/login');
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
    this.isMenuOpen = false; //close menu
  }

  navigateToUploadImages() {
    this.router.navigate(['/admin/upload-images']);
    this.isMenuOpen = false;
  }

  navigateToImageGallery() {
    this.router.navigate(['/admin/verified-images']);
    this.isMenuOpen = false;
  }

  navigateToUserManagement() {
    this.router.navigate(['/admin/user-management']);
    this.isMenuOpen = false;
  }

  navigateToModelSettings() {
    this.router.navigate(['/admin/model-settings']);
    this.isMenuOpen = false;
  }

  navigateToNotifications() {
    this.showNotificationPanel = true;
    this.isMenuOpen = false;
  }

  closeNotificationPanel() {
    this.showNotificationPanel = false;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  refreshData() {
    //reload page
    window.location.reload();
  }

  getCurrentDate(): string {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    });
  }

  getUserDisplayName(): string {
    if (!this.currentUser) {
      return 'Admin User';
    }
    
    //get full name or fallback to username
    const firstName = this.currentUser.first_name || '';
    const lastName = this.currentUser.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    
    return fullName || this.currentUser.username || 'Admin User';
  }

  getUserEmail(): string {
    return this.currentUser?.email || 'admin@mangosense.com';
  }

  getUserInitials(): string {
    if (!this.currentUser) {
      return 'A';
    }
    
    const firstName = this.currentUser.first_name || '';
    const lastName = this.currentUser.last_name || '';
    
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    } else if (this.currentUser.username) {
      return this.currentUser.username.charAt(0).toUpperCase();
    }
    
    return 'A';
  }
}
