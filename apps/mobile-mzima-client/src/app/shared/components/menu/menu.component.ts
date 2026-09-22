import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CONST, navigationMenu } from '@constants';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
})
export class MenuComponent {
  /**
   * Only the destinations this account can actually open.
   *
   * The dashboard is not offered to field monitors: the API refuses them, so
   * showing the entry would be offering a door that does not open.
   */
  public menu = navigationMenu.filter((item) => {
    if (!item.canView) return true;

    const role = localStorage.getItem(`${CONST.LOCAL_STORAGE_PREFIX}role`);
    const permissions = localStorage.getItem(`${CONST.LOCAL_STORAGE_PREFIX}permissions`);
    return item.canView(permissions, role);
  });

  constructor(private router: Router) {}

  isButtonActive(route: any): boolean {
    const currentRoute = this.router.url;

    if (route.activeRoutes) {
      for (const activeRoute of route.activeRoutes) {
        if (currentRoute.startsWith(activeRoute)) {
          return route.route === '/' || activeRoute === '/';
        }
      }
    }

    return currentRoute === route.route;
  }
}
