import { Injectable } from '@angular/core';
import { App } from '@capacitor/app';
import { CapacitorHttp, Capacitor } from '@capacitor/core';
import { STORAGE_KEYS } from '@constants';
import { AlertController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { EnvService } from './env.service';
import { NetworkService } from './network.service';
import { StorageService } from './storage.service';

interface PlatformRelease {
  latest_build?: number;
  latest_version?: string;
  store_url?: string;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Tells a reporter when the store has a newer build than the one they are
 * running.
 *
 * Reporters keep a version for as long as it keeps working, and a phone with
 * automatic updates turned off can sit on a build for a year. This asks a
 * hosted version file often enough that nobody drifts more than a week or two
 * behind, and leaves the decision with them: the prompt can always be
 * dismissed, because someone filing an incident in the field should never be
 * made to wait on a download.
 */
@Injectable({
  providedIn: 'root',
})
export class AppUpdateService {
  /** How often to ask the version file. */
  private static readonly CHECK_INTERVAL_DAYS = 7;
  /** How long "Later" buys before the same version is raised again. */
  private static readonly SNOOZE_DAYS = 7;
  /** Used when env.json does not name one. */
  private static readonly DEFAULT_MANIFEST_URL =
    'https://app.saferworld-ogaal.org/assets/app-version.json';

  constructor(
    private alertController: AlertController,
    private networkService: NetworkService,
    private storageService: StorageService,
    private translateService: TranslateService,
  ) {}

  public async checkForUpdate(): Promise<void> {
    // The browser build is served from the web client, which is always current.
    if (!Capacitor.isNativePlatform()) return;

    try {
      if (!this.isCheckDue()) return;
      if (!(await this.networkService.checkNetworkStatus())) return;

      const release = await this.fetchRelease();
      // Only record the check once one actually completed, so a failed request
      // does not buy a week of silence.
      this.storageService.setStorage(STORAGE_KEYS.UPDATE_LAST_CHECKED, String(Date.now()));
      if (!release?.latest_build || !release.store_url) return;

      const current = await this.currentBuild();
      if (current === null || current >= release.latest_build) return;
      if (this.isSnoozed(release.latest_build)) return;

      await this.presentUpdatePrompt(release);
    } catch (error) {
      // An update prompt is never worth interrupting a reporter over.
      console.error('Could not check for an app update', error);
    }
  }

  private async presentUpdatePrompt(release: PlatformRelease): Promise<void> {
    const alert = await this.alertController.create({
      header: this.translateService.instant('app_update.title'),
      message: release.latest_version
        ? this.translateService.instant('app_update.message_with_version', {
            version: release.latest_version,
          })
        : this.translateService.instant('app_update.message'),
      backdropDismiss: false,
      buttons: [
        {
          text: this.translateService.instant('app_update.later'),
          role: 'cancel',
          handler: () => this.snooze(release.latest_build!),
        },
        {
          text: this.translateService.instant('app_update.update'),
          handler: () => {
            // Capacitor hands an off-origin window.open to the system, which
            // resolves a store link to the Play Store or App Store app.
            window.open(release.store_url, '_blank');
          },
        },
      ],
    });

    await alert.present();
  }

  private async fetchRelease(): Promise<PlatformRelease | null> {
    // CapacitorHttp makes the request natively, so the version file does not
    // have to allow the webview's origin through CORS.
    const { data, status } = await CapacitorHttp.get({
      url: this.manifestUrl,
      headers: { Accept: 'application/json' },
      // A stale cached copy would keep announcing an update already installed.
      params: { t: String(Date.now()) },
    });

    if (status < 200 || status >= 300) return null;

    const manifest = typeof data === 'string' ? JSON.parse(data) : data;
    return manifest?.[Capacitor.getPlatform()] ?? null;
  }

  /** The Android versionCode, or the iOS CFBundleVersion. */
  private async currentBuild(): Promise<number | null> {
    const { build } = await App.getInfo();
    const parsed = Number.parseInt(String(build), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private get manifestUrl(): string {
    return (EnvService.ENV as any)?.app_version_url || AppUpdateService.DEFAULT_MANIFEST_URL;
  }

  private isCheckDue(): boolean {
    const last = Number(this.storageService.getStorage(STORAGE_KEYS.UPDATE_LAST_CHECKED));
    if (!Number.isFinite(last) || !last) return true;

    return Date.now() - last >= AppUpdateService.CHECK_INTERVAL_DAYS * DAY_IN_MS;
  }

  private isSnoozed(build: number): boolean {
    const snoozed = this.storageService.getStorage(STORAGE_KEYS.UPDATE_SNOOZED, 'object') as {
      build?: number;
      until?: number;
    } | null;

    // A newer build than the one that was dismissed is worth raising again.
    return !!snoozed && snoozed.build === build && Number(snoozed.until) > Date.now();
  }

  private snooze(build: number): void {
    this.storageService.setStorage(
      STORAGE_KEYS.UPDATE_SNOOZED,
      { build, until: Date.now() + AppUpdateService.SNOOZE_DAYS * DAY_IN_MS },
      'object',
    );
  }
}
