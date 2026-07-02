import { Injectable } from '@angular/core';
import { MissingTranslationHandler, MissingTranslationHandlerParams } from '@ngx-translate/core';

@Injectable()
export class ReadableMissingTranslationHandler implements MissingTranslationHandler {
  public handle(params: MissingTranslationHandlerParams): string {
    const words = params.key.split('.').pop()?.replace(/_/g, ' ') || params.key;
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
}
