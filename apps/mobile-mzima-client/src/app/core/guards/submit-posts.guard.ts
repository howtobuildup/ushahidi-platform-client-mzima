import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { CONST } from '@constants';
import { isSubmitOnlyUser } from '@helpers';
import { LandingRouteService } from '@services';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SubmitPostsGuard implements CanActivate {
  constructor(private landingRouteService: LandingRouteService) {}

  canActivate(
    _route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): boolean | Observable<boolean | UrlTree> {
    const role = localStorage.getItem(`${CONST.LOCAL_STORAGE_PREFIX}role`);
    const permissions = localStorage.getItem(`${CONST.LOCAL_STORAGE_PREFIX}permissions`);

    if (!isSubmitOnlyUser(permissions, role)) {
      return true;
    }

    if (state.url.startsWith('/post-edit') || state.url.startsWith('/no-access')) {
      return true;
    }

    return this.landingRouteService.getLandingUrl();
  }
}
