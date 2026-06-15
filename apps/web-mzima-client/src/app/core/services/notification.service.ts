import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { SnackbarComponent, SnackbarData } from '../../shared/components';
import { getErrorMessage } from '../helpers/error-message.helper';

export interface SnackbarOptions extends MatSnackBarConfig {
  wide?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  constructor(public snackBar: MatSnackBar) {}

  showError(error: unknown) {
    this.snackBar.open(getErrorMessage(error), 'Close', {
      panelClass: ['error'],
      duration: 8000,
    });
  }

  showSnackbar(data?: SnackbarData, options?: SnackbarOptions) {
    const panelClass = ['custom-snackbar'];
    options?.wide ? panelClass.push('custom-snackbar--wide') : null;
    this.snackBar.openFromComponent(SnackbarComponent, {
      ...options,
      panelClass,
      data,
    });
  }
}
