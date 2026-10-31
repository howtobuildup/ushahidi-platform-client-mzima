import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, switchMap } from 'rxjs';
import { apiHelpers } from '../helpers';
import { EnvLoader } from '../loader';
import { SurveyApiResponse, SurveyItem } from '../models';
import { ResourceService } from './resource.service';

@Injectable({
  providedIn: 'root',
})
export class SurveysService extends ResourceService<any> {
  private surveyNames$?: Observable<Map<number, string>>;
  private surveyNamesFetchedAt = 0;

  constructor(
    protected override httpClient: HttpClient,
    protected override currentLoader: EnvLoader,
  ) {
    super(httpClient, currentLoader);
  }

  getApiVersions(): string {
    return apiHelpers.API_V_5;
  }

  getResourceUrl(): string {
    return 'surveys';
  }

  saveSurvey(survey: SurveyItem, surveyId?: string) {
    if (surveyId) {
      return super.update(surveyId, survey);
    } else {
      return super.post(survey);
    }
  }

  getSurveys(url: string, params: object): Observable<SurveyApiResponse> {
    return super.get(url, params);
  }

  getSurveyById(id: string | number): Observable<any> {
    return super.getById(id);
  }

  deleteSurvey(id: string | number): Observable<any> {
    return super.delete(id);
  }

  /**
   * A survey's name, or empty when it cannot be found.
   *
   * Post tiles ask for one each, so the names are fetched once and shared. A
   * survey missing from them (a new one, or one that became visible on signing
   * in) fetches them again, at most once a minute.
   */
  public getSurveyName(id?: number | null): Observable<string> {
    if (!id) return of('');
    return this.surveyNames().pipe(
      switchMap((names) => (names.has(id) ? of(names) : this.surveyNames(true))),
      map((names) => names.get(id) ?? ''),
    );
  }

  private surveyNames(refresh = false): Observable<Map<number, string>> {
    const stale = Date.now() - this.surveyNamesFetchedAt > 60000;
    if (!this.surveyNames$ || (refresh && stale)) {
      this.surveyNamesFetchedAt = Date.now();
      this.surveyNames$ = this.getSurveys('', { only: 'id,name' }).pipe(
        map(
          (response) =>
            new Map((response?.results ?? []).map((survey) => [survey.id, survey.name])),
        ),
        catchError(() => of(new Map<number, string>())),
        shareReplay(1),
      );
    }
    return this.surveyNames$;
  }

  public removeFromFilters(surveyId: number): void {
    const localStorageKey = 'USH_filters';
    const filters = localStorage.getItem(localStorageKey)!;
    const data = JSON.parse(filters);
    if (data.form.includes(surveyId)) {
      data.form = data.form.filter((item: number) => item !== surveyId);
      localStorage.setItem(localStorageKey, JSON.stringify(data));
    }
  }
}
