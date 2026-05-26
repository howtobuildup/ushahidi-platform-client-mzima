import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class IsSignupEnabledGuard implements CanActivate {
  public isDesktop: boolean;

  constructor(private router: Router) {}

  canActivate(): Observable<boolean> | Promise<boolean> | boolean {
    this.router.navigate(['/auth/login']);
    return false;
  }
}
