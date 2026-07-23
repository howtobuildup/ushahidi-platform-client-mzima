import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, switchMap, take } from 'rxjs';
import { apiHelpers } from '../helpers';
import { EnvLoader } from '../loader';
import { ExportJobInterface } from '../models';
import { ResourceService } from './resource.service';

@Injectable({
  providedIn: 'root',
})
export class ExportJobsService extends ResourceService<any> {
  constructor(
    protected override httpClient: HttpClient,
    protected override currentLoader: EnvLoader,
  ) {
    super(httpClient, currentLoader);
  }

  getApiVersions(): string {
    return apiHelpers.API_V_3;
  }

  getResourceUrl(): string {
    return 'exports/jobs';
  }

  save(job: Partial<ExportJobInterface>) {
    return super.post(job);
  }

  override getById(id: string | number): Observable<ExportJobInterface> {
    return super.getById(id).pipe(
      map((response: any) => {
        return this.processJob(response.result || response);
      }),
    );
  }

  override get(url?: string | undefined, queryParams?: any): Observable<ExportJobInterface[]> {
    return super.get(url, queryParams).pipe(
      map((response: any) => {
        return this.processJobs(response.results || []);
      }),
    );
  }

  override delete(id: string | number): Observable<any> {
    return super.delete(id);
  }

  download(jobId: string | number): Observable<Blob> {
    return this.currentLoader.getApiUrl().pipe(
      take(1),
      switchMap((backendUrl) =>
        this.httpClient.get(`${backendUrl}${apiHelpers.API_V_5}exports/jobs/${jobId}/download`, {
          responseType: 'blob',
        }),
      ),
      map((blob) => {
        if (!blob.size) {
          throw new Error('The generated CSV file is empty. Please run the export again.');
        }
        return blob;
      }),
    );
  }

  processJobs(jobs: ExportJobInterface[]) {
    return jobs.map((job) => this.processJob(job));
  }

  private processJob(job: ExportJobInterface): ExportJobInterface {
    if (job?.status) {
      if (!job.url_expiration) {
        job.url_expiration = '';
      } else if (Number.isInteger(job.url_expiration)) {
        job.url_expiration = new Date(+job.url_expiration * 1000).toLocaleString();
      }

      job.created_timestamp = job.created_timestamp ? job.created_timestamp : job.created;
      job.created = new Date(job.created).toLocaleString();
      job.status = job.status.toLowerCase();
    }
    return job;
  }
}
