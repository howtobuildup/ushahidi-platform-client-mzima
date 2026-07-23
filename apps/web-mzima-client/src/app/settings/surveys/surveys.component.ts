import { Component, OnInit } from '@angular/core';
import { xlsFormExportHelper } from '@helpers';
import { downloadBlob } from '../../core/helpers/blob-download';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { TranslateService } from '@ngx-translate/core';
import { BreakpointService, NotificationService } from '@services';
import { forkJoin, Observable, take } from 'rxjs';
import { SurveysService, SurveyItem } from '@mzima-client/sdk';
import { ConfirmModalService } from '../../core/services/confirm-modal.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy()
@Component({
  selector: 'app-surveys',
  templateUrl: './surveys.component.html',
  styleUrls: ['./surveys.component.scss'],
})
export class SurveysComponent implements OnInit {
  public isDesktop$: Observable<boolean>;
  public surveys: SurveyItem[] = [];
  public selectedSurveys: SurveyItem[] = [];
  public isShowActions = false;

  public params = {
    page: 1,
    order: 'asc',
    limit: 0,
    current_page: 0,
    last_page: 0,
    total: 0,
  };
  public isLoading = false;

  constructor(
    private readonly surveysService: SurveysService,
    private readonly translate: TranslateService,
    private readonly confirmModalService: ConfirmModalService,
    private readonly breakpointService: BreakpointService,
    private readonly notificationService: NotificationService,
  ) {
    this.isDesktop$ = this.breakpointService.isDesktop$.pipe(untilDestroyed(this));
  }

  ngOnInit(): void {
    this.getSurveys();
  }

  private getSurveys(isAdd = false): void {
    this.isLoading = true;
    this.surveysService
      .getSurveys('', {
        page: this.params.page,
        order: this.params.order,
        limit: this.params.limit,
      })
      .subscribe({
        next: (res) => {
          this.surveys = isAdd ? [...this.surveys, ...res.results] : res.results;
          const { current_page: currentPage, last_page: lastPage, total } = res.meta;
          this.params = { ...this.params, current_page: currentPage, last_page: lastPage, total };
          this.isLoading = false;
        },
        error: (err) => {
          console.log(err);
          this.isLoading = false;
        },
      });
  }

  public duplicateSurvey() {
    this.isLoading = true;
    if (this.selectedSurveys.length !== 1) return;

    const survey: SurveyItem = this.selectedSurveys.shift()!;
    const surveyDuplicate = { ...survey, id: null, name: `${survey.name} - duplicate` };
    this.surveysService.post(surveyDuplicate).subscribe({
      next: () => {
        this.getSurveys();
      },
      error: (err) => {
        console.log(err);
        this.isLoading = false;
      },
    });
  }

  async deleteSurvey() {
    const confirmed = await this.confirmModalService.open({
      title:
        this.selectedSurveys.length > 1
          ? 'Are you sure you want to delete selected surveys?'
          : this.translate.instant('notify.survey.destroy_confirm'),
      description: `
        <p>${
          this.selectedSurveys.length > 1
            ? 'Deleting these surveys will remove it from database. This action cannot be undone.'
            : this.translate.instant('notify.survey.destroy_confirm_desc')
        }</p>
      `,

      confirmButtonText: this.translate.instant('app.yes_delete'),
      cancelButtonText: this.translate.instant('app.no_go_back'),
    });

    if (!confirmed) return;
    this.isLoading = true;
    forkJoin(
      this.selectedSurveys.map((survey) => {
        this.surveysService.removeFromFilters(survey.id);
        return this.surveysService.deleteSurvey(survey.id);
      }),
    )
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.getSurveys();
          this.selectedSurveys = [];
        },
        error: (e) => {
          console.log(e);
          this.isLoading = false;
        },
      });
  }

  public selectSurveys({ checked }: MatCheckboxChange, survey: SurveyItem) {
    if (checked) {
      this.selectedSurveys.push(survey);
    } else {
      this.selectedSurveys = this.selectedSurveys.filter((s) => s.id !== survey.id);
    }
  }

  public showActions(event: boolean) {
    this.isShowActions = event;
  }

  public loadMore(): void {
    if (this.params.current_page < this.params.last_page) {
      this.params.page += 1;
      this.getSurveys(true);
    }
  }

  public previewSurvey(event: Event, survey: SurveyItem): void {
    event.stopPropagation();
    window.open(`/post/create/${survey.id}?preview=1`, '_blank', 'noopener');
  }

  public downloadSurvey(event: Event, survey: SurveyItem): void {
    event.stopPropagation();
    this.surveysService
      .getSurveyById(survey.id)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          try {
            const fullSurvey: SurveyItem = response.result || response;
            const exported = xlsFormExportHelper.exportXlsForm(fullSurvey);
            downloadBlob(exported.blob, exported.fileName);
          } catch (error: any) {
            this.notificationService.showError(error?.message || 'Failed to export XLSForm.');
          }
        },
        error: (error) => {
          this.notificationService.showError(error?.message || 'Failed to load survey.');
        },
      });
  }
}
