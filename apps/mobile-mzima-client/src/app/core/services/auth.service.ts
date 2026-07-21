import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, switchMap, tap, throwError } from 'rxjs';
import { EnvService, SessionService } from '@services';
import { Router } from '@angular/router';
import { CONST } from '@constants';
import { EnvLoader, ResourceService, UserInterface, UsersService } from '@mzima-client/sdk';

@Injectable({
  providedIn: 'root',
})
export class AuthService extends ResourceService<any> {
  constructor(
    protected override httpClient: HttpClient,
    protected envLoader: EnvLoader,
    protected env: EnvService,
    private sessionService: SessionService,
    private router: Router,
    private userService: UsersService,
  ) {
    super(httpClient, envLoader);
  }

  getApiVersions(): string {
    return '';
  }

  getResourceUrl(): string {
    return 'oauth/token';
  }

  login(username: string, password: string): Observable<any> {
    const payload = {
      username: username,
      password: password,
      grant_type: 'password',
      client_id: this.env.environment.oauth_client_id,
      client_secret: this.env.environment.oauth_client_secret,
      scope: CONST.CLAIMED_USER_SCOPES.join(' '),
    };
    return super.post(payload).pipe(
      switchMap((authResponse) => {
        this.storeSession(authResponse, 'password');
        return this.userService.getCurrentUser();
      }),
      tap((userData) => {
        const { result } = userData;
        this.setCurrentUserToSession(result);
        this.userService.dispatchUserEvents(result);
      }),
    );
  }

  refreshAccessToken(): Observable<string> {
    const refreshToken = this.sessionService.currentRefreshToken;
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token is available'));
    }

    return super
      .post({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        client_id: this.env.environment.oauth_client_id,
        client_secret: this.env.environment.oauth_client_secret,
        scope: CONST.CLAIMED_USER_SCOPES.join(' '),
      })
      .pipe(
        tap((authResponse) => this.storeSession(authResponse, 'refresh_token')),
        map((authResponse) => authResponse.access_token),
      );
  }

  private storeSession(authResponse: any, grantType: string): void {
    const expires = authResponse.expires_in
      ? Math.floor(Date.now() / 1000) + authResponse.expires_in
      : authResponse.expires || 0;

    this.sessionService.setSessionData({
      accessToken: authResponse.access_token,
      accessTokenExpires: expires,
      grantType,
      refreshToken: authResponse.refresh_token || this.sessionService.currentRefreshToken,
      tokenType: authResponse.token_type,
    });
  }

  public setCurrentUserToSession(user: UserInterface) {
    this.sessionService.setCurrentUser({
      userId: user.id,
      realname: user.realname,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      allowed_privileges: user.allowed_privileges,
      gravatar: user.gravatar,
      language: user.language,
    });
  }

  signup(payload: { email: string; password: string; realname: string }) {
    return this.httpClient.post(
      `${this.env.environment.backend_url}${this.env.environment.api_v3}register`,
      payload,
    );
  }

  resetPassword(payload: { email: string }) {
    return this.httpClient.post(
      `${this.env.environment.backend_url}${this.env.environment.api_v3}passwordreset`,
      payload,
    );
  }

  public logout() {
    console.log('logout');
    this.sessionService.clearSessionData();
    this.sessionService.clearUserData();
    this.router.navigate(['/auth/login']);
  }
}
