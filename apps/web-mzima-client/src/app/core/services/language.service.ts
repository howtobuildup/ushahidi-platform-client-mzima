import { Injectable } from '@angular/core';
import { CONST } from '@constants';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { LanguageInterface } from '@models';
import LangJSON from '../../../assets/locales/languages.json';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private languages = new BehaviorSubject<LanguageInterface[]>(this.getConfiguredLanguages());
  public languages$ = this.languages.asObservable();

  private languageKey = `${CONST.LOCAL_STORAGE_PREFIX}language`;

  private selectedLanguage = new BehaviorSubject<string>('');
  public selectedLanguage$ = this.selectedLanguage.asObservable();
  private isRTL = new BehaviorSubject<boolean>(false);
  public isRTL$ = this.isRTL.asObservable();

  constructor(private translate: TranslateService, private session: SessionService) {
    this.translate.setDefaultLang('en');
    if (this.initialLanguage === 'null' || this.initialLanguage === null) {
      this.initialLanguage = this.resolveSupportedLanguage(
        this.session.getSiteConfigurations().language || 'en',
      );
      this.setLanguage(this.initialLanguage!);
    } else {
      this.setLanguage(this.initialLanguage!);
    }
  }

  public get initialLanguage() {
    return localStorage.getItem(this.languageKey)!;
  }

  private set initialLanguage(value: string) {
    localStorage.setItem(this.languageKey, value);
  }

  getLanguages(): LanguageInterface[] {
    return this.languages.value;
  }

  private getConfiguredLanguages(): LanguageInterface[] {
    if (LangJSON.languages && LangJSON.languages.length > 0) {
      return LangJSON.languages;
    } else {
      return [
        {
          rtl: false,
          pluralequation: 'language.pluralequation',
          code: 'en',
          name: 'English',
          nplurals: 2,
        },
      ];
    }
  }

  private setLanguage(lang: string) {
    const supportedLanguage = this.resolveSupportedLanguage(lang);
    this.translate.use(supportedLanguage);
    this.selectedLanguage.next(supportedLanguage);
    this.changeDirection(supportedLanguage);
  }

  public changeLanguage(value: string) {
    const supportedLanguage = this.resolveSupportedLanguage(value);
    this.translate.use(supportedLanguage);
    localStorage.setItem(this.languageKey, supportedLanguage);
    this.selectedLanguage.next(supportedLanguage);
    this.changeDirection(supportedLanguage);
  }

  private changeDirection(value: string) {
    this.isRTL.next(!!this.languages.value.find((l) => l.code === value)?.rtl);
  }

  private resolveSupportedLanguage(locale: string): string {
    const normalizedLocale = locale.replace('_', '-');
    const exactLanguage = this.languages.value.find(
      (language) => language.code.toLowerCase() === normalizedLocale.toLowerCase(),
    );
    if (exactLanguage) return exactLanguage.code;

    const baseLanguageCode = normalizedLocale.split('-')[0].toLowerCase();
    const baseLanguage = this.languages.value.find(
      (language) => language.code.split('-')[0].toLowerCase() === baseLanguageCode,
    );
    return baseLanguage?.code || 'en';
  }
}
