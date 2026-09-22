import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Relative time, in the active language.
 *
 * The English was assembled by concatenation, down to adding an "s" for the
 * plural, so it could not be translated at all. Each unit is a key with the
 * count as a parameter instead, and a count of one takes a key of its own,
 * which also suits languages that do not form plurals by suffix.
 *
 * Impure because a language change alters the output without the input
 * changing, and a pure pipe would keep showing the previous language until
 * something else happened to the post.
 */
@Pipe({
  name: 'dateAgo',
  pure: false,
})
export class DateAgoPipe implements PipeTransform {
  private static readonly UNITS = ['second', 'minute', 'hour', 'day', 'month', 'year'];
  private static readonly DIVIDERS = [60, 60, 24, 30, 12];

  constructor(private translate: TranslateService) {}

  transform(value: any): unknown {
    if (!value) {
      return this.translate.instant('date_ago.long_time');
    }

    let time = (Date.now() - Date.parse(value)) / 1000;
    if (time < 10) {
      return this.translate.instant('date_ago.just_now');
    }
    if (time < 60) {
      return this.translate.instant('date_ago.moment');
    }

    let index = 0;
    for (
      ;
      index < DateAgoPipe.DIVIDERS.length && Math.floor(time / DateAgoPipe.DIVIDERS[index]) > 0;
      index++
    ) {
      time /= DateAgoPipe.DIVIDERS[index];
    }

    const count = Math.floor(time);
    const unit = DateAgoPipe.UNITS[index];
    return this.translate.instant(`date_ago.${unit}${count === 1 ? '_one' : ''}`, { count });
  }
}
