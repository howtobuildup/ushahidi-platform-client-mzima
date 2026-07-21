import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService, SessionService } from '@services';
import { catchError, finalize, Observable, shareReplay, switchMap, throwError } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private refreshRequest?: Observable<string>;

  constructor(
    private session: SessionService,
    private router: Router,
    private authService: AuthService,
  ) {}

  isTokenlessRequest(req: HttpRequest<any>): boolean {
    if (req.method === 'GET') {
      if (req.url.includes('site') || req.url.includes('map') || req.url.includes('features'))
        return true;
    }
    return false;
  }

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    const authToken = this.session.currentAuthToken;
    const authTokenType = this.session.currentAuthTokenType;
    if (authToken && !this.isTokenlessRequest(req)) {
      req = req.clone({
        setHeaders: {
          Authorization: `${authTokenType} ${authToken}`,
        },
      });
    }

    return next.handle(req).pipe(
      catchError((response: HttpErrorResponse) => {
        if (response.status === 401) {
          if (!req.url.includes('oauth/token')) {
            return this.handleUnauthorized(req, next);
          }

          this.logout();
        }
        return throwError(() => response);
      }),
    );
  }

  private handleUnauthorized(req: HttpRequest<any>, next: HttpHandler) {
    if (!this.session.currentRefreshToken) {
      this.logout();
      return throwError(() => new Error('The session has expired'));
    }

    if (!this.refreshRequest) {
      this.refreshRequest = this.authService.refreshAccessToken().pipe(
        catchError((error) => {
          this.logout();
          return throwError(() => error);
        }),
        finalize(() => (this.refreshRequest = undefined)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }

    return this.refreshRequest.pipe(switchMap((token) => next.handle(this.withToken(req, token))));
  }

  private withToken(req: HttpRequest<any>, token: string): HttpRequest<any> {
    return req.clone({
      setHeaders: {
        Authorization: `${this.session.currentAuthTokenType} ${token}`,
      },
    });
  }

  private logout(): void {
    console.log('status 401');
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
