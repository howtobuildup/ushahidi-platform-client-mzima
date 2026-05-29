import { Injectable } from '@angular/core';
import { CanActivate, UrlTree } from '@angular/router';
import { CONST } from '@constants';
import { LandingRouteService } from '@services';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class LoginRedirectGuard implements CanActivate {
  constructor(private landingRouteService: LandingRouteService) {}

  canActivate(): boolean | Observable<boolean | UrlTree> {
    const userId = localStorage.getItem(`${CONST.LOCAL_STORAGE_PREFIX}userId`);
    const accessToken = localStorage.getItem(`${CONST.LOCAL_STORAGE_PREFIX}accessToken`);

    if (!userId || !accessToken) {
      return true;
    }

    return this.landingRouteService.getLandingUrl();
  }
}
