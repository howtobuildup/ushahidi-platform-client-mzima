import { Injectable } from '@angular/core';
import { CanActivate, UrlTree } from '@angular/router';
import { LandingRouteService, SessionService } from '@services';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable } from 'rxjs';

@UntilDestroy()
@Injectable({
  providedIn: 'root',
})
export class NotAuthorizedGuard implements CanActivate {
  private isLoggedIn: boolean;

  constructor(
    private landingRouteService: LandingRouteService,
    private sessionService: SessionService,
  ) {
    this.sessionService
      .getCurrentUserData()
      .pipe(untilDestroyed(this))
      .subscribe((userData) => {
        this.isLoggedIn = !!userData.userId;
      });
  }

  canActivate(): boolean | Observable<boolean | UrlTree> {
    if (this.isLoggedIn) {
      return this.landingRouteService.getLandingUrl();
    }
    return true;
  }
}
