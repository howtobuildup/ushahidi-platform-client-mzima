import { Injectable } from '@angular/core';
import { CanActivate, UrlTree } from '@angular/router';
import { LandingRouteService, LanguageService, SessionService } from '@services';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NotAuthorizedGuard implements CanActivate {
  constructor(
    private landingRouteService: LandingRouteService,
    private languageService: LanguageService,
    private sessionService: SessionService,
  ) {}

  canActivate(): boolean | Observable<boolean | UrlTree> {
    if (this.sessionService.isLogged()) {
      this.languageService.ensureSelectedLanguage();
      return this.landingRouteService.getLandingUrl();
    }
    return true;
  }
}
