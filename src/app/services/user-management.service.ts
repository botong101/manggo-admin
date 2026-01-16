import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { MangoImage } from './mango-disease.service';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  date_joined: string;
  is_active: boolean;
  is_staff: boolean;
  last_login?: string;
  total_images?: number;
  verified_images?: number;
  unverified_images?: number;
  recent_activity?: string;
  // Location information from UserProfile
  profile?: {
    province?: string;
    city?: string;
    barangay?: string;
    postal_code?: string;
    full_address?: string;
  };
}

export interface UserWithImages {
  user: User;
  images: MangoImage[];
  imageStats: {
    total: number;
    verified: number;
    unverified: number;
    healthy: number;
    diseased: number;
    leaf: number;
    fruit: number;
  };
}

export interface UserStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  users_with_profiles: number;
  total_images: number;
  average_images_per_user: number;
  recent_registrations: number;
  top_users: {
    id: number;
    username: string;
    full_name: string;
    image_count: number;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  //get users with their stats
  getUsers(params?: {
    page?: number;
    page_size?: number;
    search?: string;
    is_active?: boolean;
    is_staff?: boolean;
  }): Observable<{
    users: User[];
    pagination: {
      page: number;
      page_size: number;
      total_count: number;
      total_pages: number;
      has_next: boolean;
      has_previous: boolean;
    };
  }> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        const value = (params as any)[key];
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<any>(`${this.apiUrl}/users/`, { params: httpParams })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            // Transform the API response to include location information
            const users = response.data.users.map((user: any) => ({
              id: user.id,
              username: user.username,
              email: user.email,
              first_name: user.first_name,
              last_name: user.last_name,
              date_joined: user.date_joined,
              is_active: user.is_active,
              is_staff: user.is_staff,
              last_login: user.last_login,
              total_images: user.total_images,
              verified_images: user.verified_images,
              unverified_images: user.unverified_images,
              profile: user.profile ? {
                province: user.profile.province,
                city: user.profile.city,
                barangay: user.profile.barangay,
                postal_code: user.profile.postal_code,
                full_address: user.profile.full_address
              } : undefined
            }));
            
            return {
              users: users,
              pagination: response.data.pagination
            };
          }
          //fallback to image data if api fails
          throw new Error('API response not in expected format');
        }),
        catchError(error => {
          console.error('Error fetching users, falling back to image data:', error);
          return this.getUsersFromImages();
        })
      );
  }

  //backup method - get users from images if api fails
  private getUsersFromImages(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/classified-images/?page_size=1000`)
      .pipe(
        map(response => {
          const images = response.success ? response.data.images : [];
          const userMap = new Map<number, User>();
          
          images.forEach((image: MangoImage) => {
            if (!userMap.has(image.user.id)) {
              userMap.set(image.user.id, {
                id: image.user.id,
                username: image.user.username,
                email: image.user.email,
                first_name: image.user.first_name,
                last_name: image.user.last_name,
                date_joined: image.user.date_joined,
                is_active: true,
                is_staff: false,
                total_images: 0,
                verified_images: 0,
                unverified_images: 0
              });
            }
            
            const user = userMap.get(image.user.id)!;
            user.total_images = (user.total_images || 0) + 1;
            if (image.is_verified) {
              user.verified_images = (user.verified_images || 0) + 1;
            } else {
              user.unverified_images = (user.unverified_images || 0) + 1;
            }
          });

          return {
            users: Array.from(userMap.values()),
            pagination: {
              page: 1,
              page_size: userMap.size,
              total_count: userMap.size,
              total_pages: 1,
              has_next: false,
              has_previous: false
            }
          };
        }),
        catchError(error => {
          console.error('Error fetching images for user data:', error);
          return of({
            users: [],
            pagination: {
              page: 1,
              page_size: 0,
              total_count: 0,
              total_pages: 0,
              has_next: false,
              has_previous: false
            }
          });
        })
      );
  }

  //get user info with their images
  getUserWithImages(userId: number): Observable<UserWithImages> {
    //use new api endpoint
    return this.http.get<any>(`${this.apiUrl}/users/${userId}/images/`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            const user = response.data.user;
            const images = response.data.images;
            const stats = this.calculateImageStats(images);

            return {
              user: {
                id: user.id,
                username: user.username,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                date_joined: user.date_joined,
                is_active: true,
                is_staff: false,
                total_images: images.length,
                verified_images: stats.verified,
                unverified_images: stats.unverified
              },
              images: images,
              imageStats: stats
            };
          }
          throw new Error('API response not in expected format');
        }),
        catchError(error => {
          console.error('Error fetching user images from new API, falling back to old method:', error);
          // Fallback to old method using classified-images endpoint
          return this.http.get<any>(`${this.apiUrl}/classified-images/?page_size=1000`)
            .pipe(
              map(response => {
                const allImages = response.success ? response.data.images : [];
                const userImages = allImages.filter((image: MangoImage) => image.user.id === userId);
                
                if (userImages.length === 0) {
                  throw new Error('User not found or has no images');
                }

                const user = userImages[0].user;
                const stats = this.calculateImageStats(userImages);

                return {
                  user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    date_joined: user.date_joined,
                    is_active: true,
                    is_staff: false,
                    total_images: userImages.length,
                    verified_images: stats.verified,
                    unverified_images: stats.unverified
                  },
                  images: userImages,
                  imageStats: stats
                };
              })
            );
        })
      );
  }

  //count image stats for user
  private calculateImageStats(images: MangoImage[]) {
    const stats = {
      total: images.length,
      verified: 0,
      unverified: 0,
      healthy: 0,
      diseased: 0,
      leaf: 0,
      fruit: 0
    };

    images.forEach(image => {
      if (image.is_verified) {
        stats.verified++;
      } else {
        stats.unverified++;
      }

      const disease = (image.disease_classification || image.predicted_class || '').toLowerCase();
      if (disease.includes('healthy')) {
        stats.healthy++;
      } else {
        stats.diseased++;
      }

      //same logic as other components
      const diseaseType = this.getDiseaseType(image);
      if (diseaseType === 'leaf') {
        stats.leaf++;
      } else if (diseaseType === 'fruit') {
        stats.fruit++;
      }
    });

    return stats;
  }

  //figure out if its leaf or fruit
  private getDiseaseType(image: MangoImage): 'leaf' | 'fruit' | 'unknown' {
    //first try model_used field
    if (image.model_used) {
      return image.model_used;
    }
    
    //then try disease_type field
    if (image.disease_type && image.disease_type !== 'unknown') {
      return image.disease_type;
    }
    
    //last resort - guess from disease name
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

  //get overall user stats
  getUserStats(): Observable<UserStats> {
    return this.http.get<any>(`${this.apiUrl}/users/statistics/`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error('API response not in expected format');
        }),
        catchError(error => {
          console.error('Error fetching user stats from new API, falling back to calculation:', error);
          // Fallback to calculating from user list
          return this.getUsers({ page_size: 1000 })
            .pipe(
              map(response => {
                const users = response.users;
                const now = new Date();
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

                const totalImages = users.reduce((sum, u) => sum + (u.total_images || 0), 0);
                const averageImages = users.length > 0 ? totalImages / users.length : 0;

                const stats: UserStats = {
                  total_users: users.length,
                  active_users: users.filter(u => u.is_active).length,
                  inactive_users: users.filter(u => !u.is_active).length,
                  users_with_profiles: users.filter(u => u.profile).length,
                  total_images: totalImages,
                  average_images_per_user: Math.round(averageImages * 100) / 100,
                  recent_registrations: users.filter(u => new Date(u.date_joined) > weekAgo).length,
                  top_users: users
                    .filter(u => u.total_images && u.total_images > 0)
                    .sort((a, b) => (b.total_images || 0) - (a.total_images || 0))
                    .slice(0, 5)
                    .map(user => ({
                      id: user.id,
                      username: user.username,
                      full_name: `${user.first_name} ${user.last_name}`.trim() || user.username,
                      image_count: user.total_images || 0
                    }))
                };

                return stats;
              }),
              catchError(fallbackError => {
                console.error('Error in fallback user stats calculation:', fallbackError);
                return of({
                  total_users: 0,
                  active_users: 0,
                  inactive_users: 0,
                  users_with_profiles: 0,
                  total_images: 0,
                  average_images_per_user: 0,
                  recent_registrations: 0,
                  top_users: []
                });
              })
            );
        })
      );
  }

  //enable/disable user
  updateUserStatus(userId: number, isActive: boolean): Observable<any> {
    return this.http.put(`${this.apiUrl}/users/${userId}/`, { is_active: isActive })
      .pipe(
        catchError(error => {
          console.error('Error updating user status:', error);
          throw error;
        })
      );
  }

  //remove user
  deleteUser(userId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/${userId}/`)
      .pipe(
        catchError(error => {
          console.error('Error deleting user:', error);
          throw error;
        })
      );
  }
}
