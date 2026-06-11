import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { LanguageInterface } from '@models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { LanguageService } from '@services';

@UntilDestroy()
@Component({
  selector: 'app-language-page',
  templateUrl: './language.page.html',
  styleUrls: ['./language.page.scss'],
})
export class LanguagePage {
  public languages: LanguageInterface[] = this.languageService.getLanguages();
  public selectedLanguage = 'en';

  constructor(private router: Router, private languageService: LanguageService) {
    this.languageService.selectedLanguage$.pipe(untilDestroyed(this)).subscribe((language) => {
      this.selectedLanguage = language;
    });
  }

  public selectLanguage(languageCode: string): void {
    this.languageService.changeLanguage(languageCode);
  }

  public continue(): void {
    this.languageService.changeLanguage(this.selectedLanguage);
    this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}
