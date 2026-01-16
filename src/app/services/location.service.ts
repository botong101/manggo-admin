import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
}

export interface LocationPermissionStatus {
  granted: boolean;
  denied: boolean;
  prompt: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private readonly LOCATION_TIMEOUT = 10000; //10 sec
  private readonly HIGH_ACCURACY_OPTIONS = {
    enableHighAccuracy: true,
    timeout: this.LOCATION_TIMEOUT,
    maximumAge: 300000 //5 min cache
  };

  constructor() {}

  //check if browser supports gps
  isGeolocationSupported(): boolean {
    return 'geolocation' in navigator;
  }

  //check gps permission status
  async checkPermissionStatus(): Promise<LocationPermissionStatus> {
    if (!this.isGeolocationSupported()) {
      return { granted: false, denied: true, prompt: false };
    }

    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        return {
          granted: permission.state === 'granted',
          denied: permission.state === 'denied',
          prompt: permission.state === 'prompt'
        };
      }
    } catch (error) {
      console.warn('Permission API not supported:', error);
    }

    //fallback if permissions api not supported
    return { granted: false, denied: false, prompt: true };
  }

  //get users location
  getCurrentLocation(): Observable<LocationData> {
    return new Observable(observer => {
      if (!this.isGeolocationSupported()) {
        observer.error(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };

          // Try to get address information
          try {
            const addressInfo = await this.reverseGeocode(
              position.coords.latitude,
              position.coords.longitude
            );
            Object.assign(locationData, addressInfo);
          } catch (error) {
            console.warn('Reverse geocoding failed:', error);
          }

          observer.next(locationData);
          observer.complete();
        },
        (error) => {
          let errorMessage = 'Failed to get location';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
          }

          observer.error(new Error(errorMessage));
        },
        this.HIGH_ACCURACY_OPTIONS
      );
    });
  }

  //track location changes
  watchLocation(): Observable<LocationData> {
    return new Observable(observer => {
      if (!this.isGeolocationSupported()) {
        observer.error(new Error('Geolocation is not supported by this browser'));
        return;
      }

      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };

          //try to get address
          try {
            const addressInfo = await this.reverseGeocode(
              position.coords.latitude,
              position.coords.longitude
            );
            Object.assign(locationData, addressInfo);
          } catch (error) {
            console.warn('Reverse geocoding failed:', error);
          }

          observer.next(locationData);
        },
        (error) => {
          let errorMessage = 'Failed to watch location';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
          }

          observer.error(new Error(errorMessage));
        },
        this.HIGH_ACCURACY_OPTIONS
      );

      //cleanup
      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    });
  }

  //convert coords to address
  private async reverseGeocode(latitude: number, longitude: number): Promise<Partial<LocationData>> {
    try {
      //using free OpenStreetMap api
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'MangoSense-Admin-App/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Reverse geocoding request failed');
      }

      const data = await response.json();
      
      if (data && data.address) {
        return {
          address: data.display_name,
          city: data.address.city || data.address.town || data.address.village,
          region: data.address.state || data.address.province || data.address.region,
          country: data.address.country
        };
      }

      return {};
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return {};
    }
  }

  //make location readable
  formatLocation(location: LocationData): string {
    const parts = [];
    
    if (location.city) parts.push(location.city);
    if (location.region) parts.push(location.region);
    if (location.country) parts.push(location.country);
    
    if (parts.length > 0) {
      return parts.join(', ');
    }
    
    return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  }

  //calculate distance in km
  getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; //earth radius in km
    const dLat = this.degreesToRadians(lat2 - lat1);
    const dLon = this.degreesToRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.degreesToRadians(lat1)) * Math.cos(this.degreesToRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  //convert degrees to radians
  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  //check if accuracy is good enough
  isLocationAccurate(location: LocationData, requiredAccuracy: number = 100): boolean {
    return location.accuracy <= requiredAccuracy;
  }

  //describe accuracy level
  getAccuracyDescription(accuracy: number): string {
    if (accuracy <= 5) return 'Very High';
    if (accuracy <= 20) return 'High';
    if (accuracy <= 100) return 'Medium';
    if (accuracy <= 500) return 'Low';
    return 'Very Low';
  }
}
