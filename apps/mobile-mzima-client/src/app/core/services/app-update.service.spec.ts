import { TestBed } from '@angular/core/testing';
import { App } from '@capacitor/app';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { AlertController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

import { AppUpdateService } from './app-update.service';
import { NetworkService } from './network.service';
import { StorageService } from './storage.service';

jest.mock('@capacitor/app', () => ({ App: { getInfo: jest.fn() } }));

// Keep the real module and replace only the two pieces under test. Replacing
// it outright would take the plugin registrar with it, and importing this
// service reaches the services barrel, which registers several plugins.
jest.mock('@capacitor/core', () => {
  const actual = jest.requireActual('@capacitor/core');
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, isNativePlatform: jest.fn(), getPlatform: jest.fn() },
    CapacitorHttp: { get: jest.fn() },
  };
});

const DAY = 24 * 60 * 60 * 1000;

describe('AppUpdateService', () => {
  let service: AppUpdateService;
  let alert: { present: jest.Mock };
  let create: jest.Mock;
  let store: Record<string, string>;

  const getInfo = App.getInfo as jest.Mock;
  const httpGet = CapacitorHttp.get as unknown as jest.Mock;
  const isNative = Capacitor.isNativePlatform as jest.Mock;
  const platform = Capacitor.getPlatform as jest.Mock;

  const response = (data: unknown, status = 200) => ({ status, data, headers: {}, url: '' });
  const manifest = (release: Record<string, unknown>) => response({ android: release });

  beforeEach(() => {
    jest.clearAllMocks();
    store = {};
    alert = { present: jest.fn().mockResolvedValue(undefined) };
    create = jest.fn().mockResolvedValue(alert);

    isNative.mockReturnValue(true);
    platform.mockReturnValue('android');
    getInfo.mockResolvedValue({ build: '13', version: '1.10' });
    httpGet.mockResolvedValue(
      manifest({ latest_build: 14, latest_version: '1.11', store_url: 'https://play.test/app' }),
    );

    TestBed.configureTestingModule({
      providers: [
        AppUpdateService,
        { provide: AlertController, useValue: { create } },
        { provide: NetworkService, useValue: { checkNetworkStatus: async () => true } },
        {
          provide: StorageService,
          useValue: {
            getStorage: (key: string, type?: string) =>
              type ? JSON.parse(store[key] ?? 'null') : store[key],
            setStorage: (key: string, value: any, type?: string) => {
              store[key] = type ? JSON.stringify(value) : String(value);
            },
          },
        },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });

    service = TestBed.inject(AppUpdateService);
  });

  it('prompts when the store has a newer build', async () => {
    await service.checkForUpdate();

    expect(create).toHaveBeenCalledTimes(1);
    expect(alert.present).toHaveBeenCalled();
  });

  it('says nothing when the running build is current', async () => {
    getInfo.mockResolvedValue({ build: '14' });

    await service.checkForUpdate();

    expect(create).not.toHaveBeenCalled();
  });

  it('says nothing when the running build is ahead of the file', async () => {
    getInfo.mockResolvedValue({ build: '20' });

    await service.checkForUpdate();

    expect(create).not.toHaveBeenCalled();
  });

  it('does nothing at all on the web, where the build is always current', async () => {
    isNative.mockReturnValue(false);

    await service.checkForUpdate();

    expect(httpGet).not.toHaveBeenCalled();
  });

  it('only asks the version file once a week', async () => {
    await service.checkForUpdate();
    await service.checkForUpdate();

    expect(httpGet).toHaveBeenCalledTimes(1);
  });

  it('asks again once a week has passed', async () => {
    store['updateLastChecked'] = String(Date.now() - 8 * DAY);

    await service.checkForUpdate();

    expect(httpGet).toHaveBeenCalled();
  });

  it('does not record a check it could not make, so a flaky network costs no time', async () => {
    httpGet.mockRejectedValue(new Error('offline'));

    await service.checkForUpdate();

    expect(store['updateLastChecked']).toBeUndefined();
  });

  it('stays quiet about a build the reporter has already put off', async () => {
    store['updateSnoozed'] = JSON.stringify({ build: 14, until: Date.now() + DAY });

    await service.checkForUpdate();

    expect(create).not.toHaveBeenCalled();
  });

  it('raises a build newer than the one that was put off', async () => {
    store['updateSnoozed'] = JSON.stringify({ build: 14, until: Date.now() + DAY });
    httpGet.mockResolvedValue(manifest({ latest_build: 15, store_url: 'https://play.test/app' }));

    await service.checkForUpdate();

    expect(create).toHaveBeenCalled();
  });

  it('raises the same build again once the reprieve has run out', async () => {
    store['updateSnoozed'] = JSON.stringify({ build: 14, until: Date.now() - DAY });

    await service.checkForUpdate();

    expect(create).toHaveBeenCalled();
  });

  it('stays quiet for a platform with nowhere to send anyone', async () => {
    httpGet.mockResolvedValue(manifest({ latest_build: 14, store_url: '' }));

    await service.checkForUpdate();

    expect(create).not.toHaveBeenCalled();
  });

  it('stays quiet when the file says nothing about this platform', async () => {
    platform.mockReturnValue('ios');

    await service.checkForUpdate();

    expect(create).not.toHaveBeenCalled();
  });

  it('reads the file as text when the request hands back a string', async () => {
    httpGet.mockResolvedValue(
      response(
        JSON.stringify({ android: { latest_build: 14, store_url: 'https://play.test/app' } }),
      ),
    );

    await service.checkForUpdate();

    expect(create).toHaveBeenCalled();
  });

  it('says nothing when the version file cannot be read', async () => {
    httpGet.mockResolvedValue(response('not found', 404));

    await service.checkForUpdate();

    expect(create).not.toHaveBeenCalled();
  });
});
