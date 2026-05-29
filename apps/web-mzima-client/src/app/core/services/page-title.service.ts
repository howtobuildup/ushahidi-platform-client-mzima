import { Injectable } from '@angular/core';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';

const APP_TITLE = 'Saferworld';

@Injectable({
  providedIn: 'root',
})
export class UshahidiPageTitleStrategy extends TitleStrategy {
  constructor(
    private readonly title: Title,
    private translateService: TranslateService,
  ) {
    super();
  }

  override updateTitle(routerState: RouterStateSnapshot) {
    const title = this.buildTitle(routerState);

    if (title) {
      this.title.setTitle(`${this.translateService.instant(title)} | ${APP_TITLE}`);
    } else {
      this.title.setTitle(APP_TITLE);
    }
  }
}
