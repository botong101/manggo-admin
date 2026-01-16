import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface NotificationData {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  imageId: string;
  imageName: string;
  timestamp: string;
  diseaseClassification: string;
  diseaseType: string;
  detectionType?: string; //fruit or leaf
  confidence: number;
  isRead: boolean;
  imageUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = environment.apiUrl; //backend url
  private notificationsSubject = new BehaviorSubject<NotificationData[]>([]);
  private unreadCountSubject = new BehaviorSubject<number>(0);
  private pollingInterval: any;
  private isPolling = false;
  private pollingIntervalMs = 30000; //30 sec

  public notifications$ = this.notificationsSubject.asObservable();
  public unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private http: HttpClient) {
    //start empty - load when user clicks refresh
  }

  loadNotifications(createNew: boolean = false): void {
    const url = createNew 
      ? `${this.apiUrl}/notifications/?create_new=true`
      : `${this.apiUrl}/notifications/`;
      
    this.http.get<any>(url).subscribe({
      next: (response) => {
        //handle array or paginated response
        const data = response.notifications || response;
        const notifications: NotificationData[] = data.map((item: any) => ({
          id: item.id,
          userId: item.user_id,
          userName: item.user_name || 'Unknown User',
          userEmail: (item.user_email || '').replace(/^@/, ''), //remove @ if there
          imageId: item.image_id,
          imageName: item.image_name,
          timestamp: item.timestamp,
          diseaseClassification: item.disease_classification,
          diseaseType: item.disease_type,
          detectionType: item.detection_type || (item.disease_type && item.disease_type.toLowerCase().includes('fruit') ? 'fruit' : 'leaf'), //figure out type
          confidence: typeof item.confidence === 'string' ? parseFloat(item.confidence) : (item.confidence || 0), //handle string or number
          isRead: item.is_read || false,
          imageUrl: item.image_url
        }));
        
        this.notificationsSubject.next(notifications);
        this.updateUnreadCount(notifications);
      },
      error: (error) => {
        console.error('Error loading notifications:', error);
      }
    });
  }

  //manual refresh - gets all notifications
  refreshNotifications(): void {
    this.loadNotifications(false);  //load all without creating new
  }

  markAsRead(notificationId: string): void {
    this.http.patch(`${this.apiUrl}/notifications/${notificationId}/mark-read/`, {}).subscribe({
      next: () => {
        const currentNotifications = this.notificationsSubject.value;
        const updatedNotifications = currentNotifications.map(notification =>
          notification.id === notificationId
            ? { ...notification, isRead: true }
            : notification
        );
        this.notificationsSubject.next(updatedNotifications);
        this.updateUnreadCount(updatedNotifications);
      },
      error: (error) => {
        console.error('Error marking notification as read:', error);
      }
    });
  }

  markAllAsRead(): void {
    this.http.patch(`${this.apiUrl}/notifications/mark-all-read/`, {}).subscribe({
      next: () => {
        const currentNotifications = this.notificationsSubject.value;
        const updatedNotifications = currentNotifications.map(notification => ({
          ...notification,
          isRead: true
        }));
        this.notificationsSubject.next(updatedNotifications);
        this.updateUnreadCount(updatedNotifications);
      },
      error: (error) => {
        console.error('Error marking all notifications as read:', error);
      }
    });
  }

  deleteNotification(notificationId: string): void {
    this.http.delete(`${this.apiUrl}/notifications/${notificationId}/`).subscribe({
      next: () => {
        const currentNotifications = this.notificationsSubject.value;
        const updatedNotifications = currentNotifications.filter(
          notification => notification.id !== notificationId
        );
        this.notificationsSubject.next(updatedNotifications);
        this.updateUnreadCount(updatedNotifications);
      },
      error: (error) => {
        console.error('Error deleting notification:', error);
      }
    });
  }

  deleteSelectedNotifications(notificationIds: string[]): void {
    this.http.post(`${this.apiUrl}/notifications/delete-selected/`, { ids: notificationIds }).subscribe({
      next: () => {
        const currentNotifications = this.notificationsSubject.value;
        const updatedNotifications = currentNotifications.filter(
          notification => !notificationIds.includes(notification.id)
        );
        this.notificationsSubject.next(updatedNotifications);
        this.updateUnreadCount(updatedNotifications);
      },
      error: (error) => {
        console.error('Error deleting selected notifications:', error);
      }
    });
  }

  private updateUnreadCount(notifications: NotificationData[]): void {
    const unreadCount = notifications.filter(n => !n.isRead).length;
    this.unreadCountSubject.next(unreadCount);
  }

  getNotificationById(id: string): NotificationData | undefined {
    return this.notificationsSubject.value.find(notification => notification.id === id);
  }

  //live polling
  startPolling(): void {
    if (this.isPolling) {
      return; //already polling
    }

    this.isPolling = true;
    //load notifs now
    this.loadNotifications(false);
    
    //setup interval
    this.pollingInterval = setInterval(() => {
      this.loadNotifications(false);
    }, this.pollingIntervalMs);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
  }

  isCurrentlyPolling(): boolean {
    return this.isPolling;
  }

  setPollingInterval(intervalMs: number): void {
    this.pollingIntervalMs = intervalMs;
    
    //restart with new interval
    if (this.isPolling) {
      this.stopPolling();
      this.startPolling();
    }
  }

  //check for new notifs
  private checkForNewNotifications(): void {
    const currentNotifications = this.notificationsSubject.value;
    const currentIds = new Set(currentNotifications.map(n => n.id));
    
    this.http.get<any>(`${this.apiUrl}/notifications/`).subscribe({
      next: (response) => {
        const data = response.notifications || response;
        const notifications: NotificationData[] = data.map((item: any) => ({
          id: item.id,
          userId: item.user_id,
          userName: item.user_name || 'Unknown User',
          userEmail: (item.user_email || '').replace(/^@/, ''),
          imageId: item.image_id,
          imageName: item.image_name,
          timestamp: item.timestamp,
          diseaseClassification: item.disease_classification,
          diseaseType: item.disease_type,
          detectionType: item.detection_type || (item.disease_type && item.disease_type.toLowerCase().includes('fruit') ? 'fruit' : 'leaf'),
          confidence: typeof item.confidence === 'string' ? parseFloat(item.confidence) : (item.confidence || 0),
          isRead: item.is_read || false,
          imageUrl: item.image_url
        }));
        
        //find new ones
        const newNotifications = notifications.filter(n => !currentIds.has(n.id));
        
        
        this.notificationsSubject.next(notifications);
        this.updateUnreadCount(notifications);
      },
      error: (error) => {
        console.error('Error checking for new notifications:', error);
      }
    });
  }
}