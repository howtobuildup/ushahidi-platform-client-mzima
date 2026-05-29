import { Injectable } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { CONST } from '@constants';
import { isSubmitOnlyUser } from '@helpers';
import { SurveyItem, SurveysService } from '@mzima-client/sdk';
import { catchError, map, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class LandingRouteService {
  constructor(private router: Router, private surveysService: SurveysService) {}

  public getLandingUrl(): Observable<UrlTree> {
    const role = localStorage.getItem(`${CONST.LOCAL_STORAGE_PREFIX}role`) || '';
    const permissions = localStorage.getItem(`${CONST.LOCAL_STORAGE_PREFIX}permissions`) || '';

    if (isSubmitOnlyUser(permissions, role)) {
      return this.getSubmitPostsLandingUrl(role);
    }

    return of(this.router.parseUrl('/map'));
  }

  private getSubmitPostsLandingUrl(role: string): Observable<UrlTree> {
    return this.surveysService.get().pipe(
      map((response) => {
        const survey = response.results?.find((item: SurveyItem) => {
          return item.everyone_can_create || item.can_create?.includes(role);
        });
        return this.router.parseUrl(survey ? `/post-edit?surveyId=${survey.id}` : '/no-access');
      }),
      catchError(() => of(this.router.parseUrl('/no-access'))),
    );
  }
}
