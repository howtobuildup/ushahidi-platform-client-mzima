import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { PollingService, BreakpointService, NotificationService } from '@services';
import { ConfirmModalService } from '../../core/services/confirm-modal.service';
import {
  ExportJobsService,
  FormsService,
  FormInterface,
  ExportJobInterface,
} from '@mzima-client/sdk';

@UntilDestroy()
@Component({
  selector: 'app-data-export',
  templateUrl: './data-export.component.html',
  styleUrls: ['./data-export.component.scss'],
})
export class DataExportComponent implements OnInit {
  public isDesktop$: Observable<boolean>;
  forms: FormInterface[] = [];
  fieldsMap: any = {};
  exportJobs: ExportJobInterface[] = [];
  showProgress = false;
  exportView = true;
  exportJobsReady = false;
  selectedFormId: string | number = '';

  constructor(
    private formsService: FormsService,
    private exportJobsService: ExportJobsService,
    private pollingService: PollingService,
    private breakpointService: BreakpointService,
    private confirmModalService: ConfirmModalService,
    private notificationService: NotificationService,
  ) {
    this.isDesktop$ = this.breakpointService.isDesktop$.pipe(untilDestroyed(this));
  }

  ngOnInit() {
    this.formsService.get().subscribe((forms) => {
      this.forms = forms.results;
      this.attachFormAttributes();
    });
    this.pollingService.exportFinished$.pipe(untilDestroyed(this)).subscribe(() => {
      this.showProgress = false;
      this.loadExportJobs();
    });
    this.pollingService.exportFailed$.pipe(untilDestroyed(this)).subscribe(() => {
      this.showProgress = false;
      this.loadExportJobs();
    });
    this.loadExportJobs();
  }

  loadExportJobs() {
    this.exportJobsReady = false;
    this.exportJobsService.get().subscribe({
      next: (jobs) => {
        this.exportJobs = jobs.reverse();
        this.exportJobsReady = true;
      },
      error: (err) => {
        console.error('Export failed: ', err);
        this.exportJobsReady = true;
      },
    });
  }

  exportAll() {
    if (!this.selectedFormId) return;
    this.pollingService
      .startExport({
        filters: { form: [Number(this.selectedFormId)] },
        send_to_hdx: false,
        include_hxl: false,
        send_to_browser: true,
      })
      .subscribe({
        error: (error) => {
          this.showProgress = false;
          this.notificationService.showError(error);
        },
      });
    this.showProgress = true;
  }

  selectAll(form: FormInterface) {
    if (this.isAllSelected(form)) {
      form.attributes?.forEach((attr) => {
        this.fieldsMap[form.id][attr.key] = false;
      });
    } else {
      form.attributes?.forEach((attr) => {
        this.fieldsMap[form.id][attr.key] = true;
      });
    }
  }

  isAllSelected(form: FormInterface) {
    return this.getSelectedAttrCount(form.id) === form.attributes?.length;
  }

  private getSelectedAttrCount(formId: string | number) {
    return Object.values(this.fieldsMap[formId]).filter((q) => !!q).length;
  }

  exportSelected() {
    if (!this.selectedFormId) return;
    const fields: string[] = [];
    const selectedFields = this.fieldsMap[this.selectedFormId] || {};
    Object.keys(selectedFields).forEach((key) => {
      if (selectedFields[key]) fields.push(key);
    });
    this.pollingService
      .startExport({
        fields,
        filters: { form: [Number(this.selectedFormId)] },
        send_to_hdx: false,
        include_hxl: false,
        send_to_browser: true,
      })
      .subscribe({
        error: (error) => {
          this.showProgress = false;
          this.notificationService.showError(error);
        },
      });
    this.showProgress = true;
  }

  downloadExport(job: ExportJobInterface) {
    this.exportJobsService.download(job.id).subscribe({
      next: (blob) => {
        this.downloadBlob(blob, `csv-export-${job.id}.csv`);
      },
      error: (error) => {
        this.notificationService.showError(error);
      },
    });
  }

  selectFields() {
    if (!this.selectedFormId) return;
    this.exportView = !this.exportView;
  }

  async deleteExport(job: ExportJobInterface) {
    const confirmed = await this.confirmModalService.open({
      title: 'Delete this exported file?',
      description: '<p>This removes the export record and its downloadable file.</p>',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
    });
    if (!confirmed) return;

    this.exportJobsService.delete(job.id).subscribe({
      next: () => {
        this.exportJobs = this.exportJobs.filter((item) => item.id !== job.id);
      },
    });
  }

  get selectedForm(): FormInterface | undefined {
    return this.forms.find((form) => String(form.id) === String(this.selectedFormId));
  }

  private attachFormAttributes() {
    this.forms.forEach((form) => {
      this.formsService
        .getAttributes(form.id.toString())
        .pipe()
        .subscribe({
          next: (attr) => {
            form.attributes = attr;
            this.fieldsMap[form.id] = {};
          },
        });
    });
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
  }
}
