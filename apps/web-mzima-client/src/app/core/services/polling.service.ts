import { Injectable, OnDestroy, RendererFactory2 } from '@angular/core';
import {
  Observable,
  Subject,
  switchMap,
  timer,
  retry,
  share,
  takeUntil,
  forkJoin,
  map,
} from 'rxjs';
import { DataImportService, ExportJobsService, ExportJobInterface } from '@mzima-client/sdk';
import { NotificationService } from './notification.service';
import { EnvService } from './env.service';

@Injectable({
  providedIn: 'root',
})
export class PollingService implements OnDestroy {
  private currentPool = {
    importing: 0,
    exporting: 0,
  };
  stopImportPolling = new Subject();
  stopExportPolling = new Subject();
  private importFinished = new Subject();
  importFinished$ = this.importFinished.asObservable();
  private importFailed = new Subject();
  importFailed$ = this.importFailed.asObservable();
  private exportFinished = new Subject<ExportJobInterface>();
  exportFinished$ = this.exportFinished.asObservable();
  private exportFailed = new Subject<ExportJobInterface | unknown>();
  exportFailed$ = this.exportFailed.asObservable();
  private renderer;

  constructor(
    private dataImportService: DataImportService,
    private exportJobsService: ExportJobsService,
    private notificationService: NotificationService,
    private env: EnvService,
    private rendererFactory: RendererFactory2,
  ) {
    this.renderer = this.rendererFactory.createRenderer(null, null);
  }

  getImportJobs() {
    this.dataImportService.get().subscribe((allJobs) => {
      const q = allJobs.results
        .filter((job: any) => job.status !== 'SUCCESS' && job.status !== 'FAILED')
        .map((j: any) => this.dataImportService.getById(j.id));
      this.startImportPolling(q);
    });
  }

  getImportJobsById(jobs: string[]) {
    const q = jobs.map((j) => this.dataImportService.getById(j));
    this.startImportPolling(q);
  }

  private startImportPolling(queries: Observable<any>[]) {
    this.currentPool.importing = queries.length;
    const nextQueries: Observable<any>[] = [];
    timer(this.env.environment.export_polling_interval || 30 * 1000)
      .pipe(
        switchMap(() => forkJoin(queries)),
        retry(),
        share(),
        takeUntil(this.stopImportPolling),
      )
      .subscribe((result) => {
        result.forEach((job: any) => {
          if (job.status === 'SUCCESS') {
            this.importFinished.next(job);
          } else if (job.status === 'FAILED') {
            this.importFailed.next(job);
            this.notificationService.showError(job.errors || 'Import failed');
          } else {
            nextQueries.push(this.dataImportService.getById(job.id));
          }
        });
        if (nextQueries.length) {
          this.startImportPolling(nextQueries);
        } else {
          this.currentPool.importing = 0;
        }
      });
  }

  private showNotification(type: 'success' | 'error' | 'started') {
    switch (type) {
      case 'success':
        this.notificationService.showSnackbar(
          {
            icon: {
              color: 'success',
              name: 'thumb-up',
            },
            title: 'notify.export.upload_complete',
            buttons: [
              {
                color: 'primary',
                text: 'notify.export.confirmation',
              },
            ],
          },
          {
            duration: 0,
            wide: true,
          },
        );
        break;

      case 'started':
        this.notificationService.showSnackbar(
          {
            icon: {
              color: 'success',
              name: 'ellipses',
            },
            title: 'notify.export.in_progress',
            isLoading: true,
            buttons: [
              {
                color: 'danger',
                text: 'notify.export.cancel_export',
                handler: () => {
                  this.stopExportPolling.next(true);
                },
              },
              {
                color: 'primary',
                text: 'notify.export.confirmation',
              },
            ],
          },
          {
            duration: 0,
            wide: true,
          },
        );
        break;
      default:
        this.notificationService.showError('Failed to export');
        break;
    }
  }

  private downloadBlob(blob: Blob, fileName: string) {
    const URL = window.URL || window.webkitURL;

    const anchor: HTMLAnchorElement = this.renderer.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = fileName;
    this.renderer.appendChild(document.body, anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => {
      URL.revokeObjectURL(anchor.href);
    }, 0);
  }

  startExport(query: Partial<ExportJobInterface>) {
    query.entity_type = 'post';
    this.showNotification('started');

    return this.exportJobsService.save(query).pipe(
      map((job) => {
        this.startExportPolling([this.exportJobsService.getById(job.id)]);
        return job.id;
      }),
    );
  }

  getCurrentPool() {
    return this.currentPool;
  }

  private startExportPolling(queries: Observable<any>[]) {
    this.currentPool.exporting = queries.length;

    const nextQueries: Observable<any>[] = [];
    timer(6000)
      .pipe(
        switchMap(() => forkJoin(queries)),
        retry(),
        share(),
        takeUntil(this.stopExportPolling),
      )
      .subscribe((result) => {
        result.forEach((job) => {
          const status = this.normalizedStatus(job);
          if (status === 'success') {
            if (job.send_to_browser) {
              this.exportJobsService.download(job.id).subscribe({
                next: (blob) => {
                  this.downloadBlob(blob, `csv-export-${job.id}.csv`);
                  this.exportFinished.next(job);
                  this.showNotification('success');
                },
                error: (error) => {
                  this.exportFailed.next(error);
                  this.notificationService.showError(error);
                },
              });
            } else {
              this.exportFinished.next(job);
              this.showNotification('success');
            }
          } else if (status === 'failed') {
            this.exportFailed.next(job);
            this.showNotification('error');
          } else {
            nextQueries.push(this.exportJobsService.getById(job.id));
          }
        });
        if (nextQueries.length) {
          this.startExportPolling(nextQueries);
        } else {
          this.currentPool.exporting = 0;
        }
      });
  }

  private normalizedStatus(job: ExportJobInterface): string {
    return String(job?.status || '').toLowerCase();
  }

  ngOnDestroy() {
    this.stopImportPolling.next(true);
    this.stopExportPolling.next(true);
  }
}
