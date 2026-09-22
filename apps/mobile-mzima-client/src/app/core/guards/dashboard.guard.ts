import { Injectable } from '@angular/core';
import { CanActivate, UrlTree } from '@angular/router';
import { CONST } from '@constants';
import { canViewDashboard } from '@helpers';
import { LandingRouteService } from '@services';
import { Observable } from 'rxjs';

/**
 * Keeps the dashboard away from field monitors.
 *
 * Not a security measure: the API refuses them regardless. This is so the app
 * never offers a door that will not open, and so a monitor is not nudged into
 * watching counts. The job is to report what is happening; a scoreboard
 * quietly reframes that as a number to move.
 */
@Injectable({
  providedIn: 'root',
})
export class DashboardGuard implements CanActivate {
  constructor(private landingRouteService: LandingRouteService) {}

  canActivate(): boolean | Observable<boolean | UrlTree> {
    const role = localStorage.getItem(`${CONST.LOCAL_STORAGE_PREFIX}role`);
    const permissions = localStorage.getItem(`${CONST.LOCAL_STORAGE_PREFIX}permissions`);

    return canViewDashboard(permissions, role) || this.landingRouteService.getLandingUrl();
  }
}
