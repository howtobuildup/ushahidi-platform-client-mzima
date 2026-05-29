import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';

import { SessionService } from '@services';

@Injectable({
  providedIn: 'root',
})
export class AuthorizedGuard implements CanActivate {
  public isDesktop: boolean;

  constructor(private router: Router, private sessionService: SessionService) {}

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    const isLogged = this.sessionService.isLogged();
    if (!isLogged) {
      console.warn('Not authorized');
      return this.router.createUrlTree(['/auth/login'], {
        queryParams: { returnUrl: state.url },
      });
    } else {
      return true;
    }
  }
}
