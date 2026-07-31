import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface DevicePosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  timestamp?: number;
}

interface SafeGeolocationPlugin {
  getCurrentPosition(options: { maximumAge: number; timeout: number }): Promise<DevicePosition>;
  checkPermissions(): Promise<DeviceLocationPermissionStatus>;
  requestPermissions(options?: {
    permissions: ['location'];
  }): Promise<DeviceLocationPermissionStatus>;
}

interface DeviceLocationPermissionStatus {
  location: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';
  coarseLocation?: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';
}

const SafeGeolocation = registerPlugin<SafeGeolocationPlugin>('SafeGeolocation');

@Injectable({ providedIn: 'root' })
export class DeviceLocationService {
  private request?: Promise<DevicePosition>;

  public async hasPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;

    try {
      const status = await this.checkPermissions();
      return status.location === 'granted' || status.coarseLocation === 'granted';
    } catch (error) {
      console.error('Unable to check location permission', error);
      return false;
    }
  }

  public async requestPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;

    try {
      const status =
        Capacitor.getPlatform() === 'android'
          ? await SafeGeolocation.requestPermissions({ permissions: ['location'] })
          : await Geolocation.requestPermissions();
      return status.location === 'granted' || status.coarseLocation === 'granted';
    } catch (error) {
      console.error('Unable to request location permission', error);
      return false;
    }
  }

  public getCurrentPosition(): Promise<DevicePosition> {
    if (this.request) return this.request;

    this.request = this.requestCurrentPosition().finally(() => {
      this.request = undefined;
    });

    return this.request;
  }

  private async requestCurrentPosition(): Promise<DevicePosition> {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('Device location is only available in the native app');
    }

    const options = {
      maximumAge: 60_000,
      timeout: 20_000,
    };

    if (!(await this.hasPermission())) {
      throw new Error('Location permission is required');
    }

    // Android uses the app-owned plugin backed by LocationManager. This avoids
    // device-specific crashes inside Google Play Services' fused location API.
    if (Capacitor.getPlatform() === 'android') {
      return SafeGeolocation.getCurrentPosition(options);
    }

    return Geolocation.getCurrentPosition({
      ...options,
      enableHighAccuracy: true,
    });
  }

  private checkPermissions(): Promise<DeviceLocationPermissionStatus> {
    return Capacitor.getPlatform() === 'android'
      ? SafeGeolocation.checkPermissions()
      : Geolocation.checkPermissions();
  }
}
