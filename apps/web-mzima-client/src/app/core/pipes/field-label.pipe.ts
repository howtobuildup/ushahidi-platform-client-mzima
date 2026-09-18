import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

interface TranslatableField {
  label?: string;
  // Keyed by language, then by the key being translated:
  //   { "so": { "label": "Magaca Mashruuca", "options": { … } } }
  // An empty set arrives as [], so this is never indexed blindly.
  translations?: Record<string, Record<string, unknown>> | unknown[];
}

/**
 * A survey field's label in the active language.
 *
 * Field labels are not application text: they are written when the survey is
 * built and differ per deployment, so they cannot live in the locale files.
 * Ushahidi stores their translations against the field and the API already
 * sends them, they were simply never read, which left the detail panel in the
 * survey's base language however the interface was switched.
 *
 * Falls back to the base label, so a field translated into some languages and
 * not others still reads.
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
    const fallback = field?.label || '';
    if (!field?.translations || Array.isArray(field.translations)) {
      return fallback;
    }

    const language = this.translate.currentLang || this.translate.defaultLang;
    const translated = field.translations[language]?.['label'];

    return typeof translated === 'string' && translated.trim() ? translated.trim() : fallback;
  }
}
