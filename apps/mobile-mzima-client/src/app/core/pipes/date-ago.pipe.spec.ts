import { DateAgoPipe } from './date-ago.pipe';

describe('DateAgoPipe', () => {
  // Returns the key and count rather than a translation, so the tests assert
  // which key was chosen instead of restating the English.
  const translate = {
    instant: (key: string, params?: any) => (params ? `${key}:${params.count}` : key),
  } as any;
  const pipe = new DateAgoPipe(translate);

  const ago = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();

  const MINUTE = 60;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const MONTH = 30 * DAY;
  const YEAR = 12 * MONTH;

  it('asks for the singular when there is one of something', () => {
    expect(pipe.transform(ago(MONTH))).toBe('date_ago.month_one:1');
    expect(pipe.transform(ago(DAY))).toBe('date_ago.day_one:1');
    expect(pipe.transform(ago(YEAR))).toBe('date_ago.year_one:1');
  });

  it('asks for the plural for anything else', () => {
    expect(pipe.transform(ago(3 * MONTH))).toBe('date_ago.month:3');
    expect(pipe.transform(ago(2 * DAY))).toBe('date_ago.day:2');
    expect(pipe.transform(ago(5 * MINUTE))).toBe('date_ago.minute:5');
  });

  it('picks the largest unit that fits', () => {
    expect(pipe.transform(ago(90 * MINUTE))).toBe('date_ago.hour_one:1');
    expect(pipe.transform(ago(36 * HOUR))).toBe('date_ago.day_one:1');
  });

  it('has words for the very recent', () => {
    expect(pipe.transform(ago(2))).toBe('date_ago.just_now');
    expect(pipe.transform(ago(30))).toBe('date_ago.moment');
  });

  it('has something to say about nothing', () => {
    expect(pipe.transform(null)).toBe('date_ago.long_time');
    expect(pipe.transform('')).toBe('date_ago.long_time');
  });

  it('never runs off the end of the units', () => {
    expect(pipe.transform(ago(40 * YEAR))).toBe('date_ago.year:40');
  });
});
