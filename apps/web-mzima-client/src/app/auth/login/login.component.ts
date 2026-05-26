import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BreakpointService } from '@services';
import { Observable } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  public isDesktop$: Observable<boolean>;

  constructor(
    private matDialogRef: MatDialogRef<LoginComponent>,
    private breakpointService: BreakpointService,
  ) {
    this.isDesktop$ = this.breakpointService.isDesktop$.pipe(untilDestroyed(this));
  }

  public cancel() {
    this.matDialogRef.close('cancel');
  }

  public successfully(state: boolean): void {
    this.matDialogRef.close(state);
  }
}
