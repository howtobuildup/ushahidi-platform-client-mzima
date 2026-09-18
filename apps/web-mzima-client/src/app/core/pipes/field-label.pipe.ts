import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

interface TranslatableField {
  label?: string;
  translations?: { language?: string; translated_key?: string; translation?: string }[];
}

/**
 * A survey field's label in the active language.
 *
 * Field labels are not application text: they are written when the survey is
 * built and differ per deployment, so they cannot live in the locale files.
 * Ushahidi stores their translations against the field itself and the API
 * already sends them, they were simply never read, which left the survey in
 * its base language however the interface was switched.
 *
 * Falls back to the base label, so a field translated into some languages and
 * not others still reads sensibly.
 *
 * Impure because a language change alters the output without the input
 * changing.
 */
@Pipe({
  name: 'fieldLabel',
  pure: false,
})
export class FieldLabelPipe implements PipeTransform {
  constructor(private translate: TranslateService) {}

  transform(field: TranslatableField | null | undefined): string {
    if (!field) {
      return '';
    }

    const language = this.translate.currentLang || this.translate.defaultLang;
    const translated = (field.translations || []).find(
      (entry) =>
        entry?.language === language &&
        entry?.translated_key === 'label' &&
        !!entry?.translation?.trim(),
    );

    return translated?.translation?.trim() || field.label || '';
  }
}
