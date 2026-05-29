import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { CONST } from '@constants';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    const userId = localStorage.getItem(`${CONST.LOCAL_STORAGE_PREFIX}userId`);
    const accessToken = localStorage.getItem(`${CONST.LOCAL_STORAGE_PREFIX}accessToken`);

    if (userId && accessToken) {
      return true;
    }

    return this.router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  }
}
