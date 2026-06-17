import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { PollingService } from '../../../core/services/polling.service';

@UntilDestroy()
@Component({
  selector: 'app-import-results',
  templateUrl: './import-results.component.html',
  styleUrls: ['./import-results.component.scss'],
})
export class ImportResultsComponent implements OnInit {
  importFinished = false;
  importFailed = false;
  filename: string;
  errorMessage: string;
  collectionId: any;
  importJobs: any;
  pollingInfo: any;
  document: any = document;

  constructor(
    private pollingService: PollingService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const jobId = this.route.snapshot.queryParamMap.get('job')?.split(',');
    if (jobId) {
      this.pollingService.getImportJobsById(jobId);
      this.pollingImportFinished();
    } else {
      this.pollingService.getImportJobs();
      this.pollingImportFinished();
    }
  }

  private pollingImportFinished() {
    this.pollingService.importFinished$.pipe(untilDestroyed(this)).subscribe((job: any) => {
      this.importFinished = true;
      this.importFailed = false;
      this.collectionId = job.collection_id;
      this.filename = job.filename;
    });

    this.pollingService.importFailed$.pipe(untilDestroyed(this)).subscribe((job: any) => {
      this.importFailed = true;
      this.importFinished = false;
      this.filename = job.filename;
      this.errorMessage = this.getImportErrorMessage(job.errors);
    });
  }

  private getImportErrorMessage(errors: any): string {
    if (!errors) {
      return 'The import failed. Please review the CSV file and try again.';
    }

    if (typeof errors === 'string') {
      return errors;
    }

    return JSON.stringify(errors);
  }

  getPollingInfo() {
    this.pollingInfo = this.pollingService.getCurrentPool();
  }
}
