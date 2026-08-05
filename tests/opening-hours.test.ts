/**
 * The seed converts the client sheet's freeform hours into the day-indexed
 * shape the API validates and the openNow filter queries. Getting this wrong
 * would make venues advertise the wrong opening times, so it is tested against
 * the real strings that appear in the CSV.
 */
import { describe, expect, it } from 'vitest';
import {
  normalizeOpeningHours,
  parseClockTime,
  parseFreeformHours,
  parseOpeningHoursCell,
} from '../src/utils/openingHours';

describe('parseClockTime', () => {
  it.each([
    ['10am', '10:00'],
    ['6pm', '18:00'],
    ['12pm', '12:00'],
    ['12am', '00:00'],
    ['9:30am', '09:30'],
    ['11:45pm', '23:45'],
    ['18:00', '18:00'],
    ['9:05', '09:05'],
  ])('parses %s → %s', (input, expected) => {
    expect(parseClockTime(input)).toBe(expected);
  });

  it.each(['noon', '25:00', '13pm', '', 'later'])('rejects %s', (input) => {
    expect(parseClockTime(input)).toBeNull();
  });
});

describe('normalizeOpeningHours', () => {
  it('converts the exact shape found in the client CSV', () => {
    const fromSheet = {
      mon: '10am-6pm',
      tue: '10am-6pm',
      wed: '10am-6pm',
      thu: '10am-6pm',
      fri: '10am-6pm',
      sat: '10am-5pm',
      sun: 'closed',
    };

    expect(normalizeOpeningHours(fromSheet)).toEqual({
      '1': { open: '10:00', close: '18:00' },
      '2': { open: '10:00', close: '18:00' },
      '3': { open: '10:00', close: '18:00' },
      '4': { open: '10:00', close: '18:00' },
      '5': { open: '10:00', close: '18:00' },
      '6': { open: '10:00', close: '17:00' },
      '0': null,
    });
  });

  it('maps a 24/7-style range including the 11pm close', () => {
    expect(normalizeOpeningHours({ mon: '8am-11pm' })).toEqual({
      '1': { open: '08:00', close: '23:00' },
    });
  });

  it('keeps an overnight range as-is rather than inverting it', () => {
    // close < open is meaningful: the venue trades past midnight.
    expect(normalizeOpeningHours({ fri: '8pm-2am' })).toEqual({
      '5': { open: '20:00', close: '02:00' },
    });
  });

  it('is idempotent on already-normalised input', () => {
    const normalized = { '1': { open: '10:00', close: '18:00' }, '0': null };
    expect(normalizeOpeningHours(normalized)).toEqual(normalized);
  });

  it('drops days it cannot parse instead of guessing', () => {
    const result = normalizeOpeningHours({
      mon: '10am-6pm',
      tue: 'by appointment',
      wed: 'call ahead',
    });
    // An absent day means "unknown", which is honest; a guessed one would not be.
    expect(result).toEqual({ '1': { open: '10:00', close: '18:00' } });
  });

  it('accepts long day names and mixed case', () => {
    expect(normalizeOpeningHours({ Monday: '9AM - 5PM', SUNDAY: 'Closed' })).toEqual({
      '1': { open: '09:00', close: '17:00' },
      '0': null,
    });
  });

  it('returns undefined when nothing is salvageable', () => {
    expect(normalizeOpeningHours({ mon: 'whenever' })).toBeUndefined();
    expect(normalizeOpeningHours({})).toBeUndefined();
    expect(normalizeOpeningHours(null)).toBeUndefined();
    expect(normalizeOpeningHours('10am-6pm')).toBeUndefined();
    expect(normalizeOpeningHours([1, 2])).toBeUndefined();
  });

  it('ignores keys that are not days', () => {
    expect(normalizeOpeningHours({ holidays: '10am-6pm', mon: '10am-6pm' })).toEqual({
      '1': { open: '10:00', close: '18:00' },
    });
  });
});

describe('parseFreeformHours', () => {
  it('expands a day range — "Tue-Sat 11am-6pm"', () => {
    expect(parseFreeformHours('Tue-Sat 11am-6pm')).toEqual({
      '2': { open: '11:00', close: '18:00' },
      '3': { open: '11:00', close: '18:00' },
      '4': { open: '11:00', close: '18:00' },
      '5': { open: '11:00', close: '18:00' },
      '6': { open: '11:00', close: '18:00' },
    });
  });

  it('wraps a range across the end of the week — "Tue-Sun"', () => {
    const result = parseFreeformHours('Tue-Sun 11am-6pm');
    expect(Object.keys(result!).sort()).toEqual(['0', '2', '3', '4', '5', '6']);
    // Monday is genuinely absent, not closed.
    expect(result).not.toHaveProperty('1');
  });

  it('handles multiple clauses, the more specific one winning', () => {
    expect(parseFreeformHours('Mon-Sat 9am-5pm; Sun 12pm-5pm')).toEqual({
      '1': { open: '09:00', close: '17:00' },
      '2': { open: '09:00', close: '17:00' },
      '3': { open: '09:00', close: '17:00' },
      '4': { open: '09:00', close: '17:00' },
      '5': { open: '09:00', close: '17:00' },
      '6': { open: '09:00', close: '17:00' },
      '0': { open: '12:00', close: '17:00' },
    });
  });

  it('treats "daily" and a bare range as every day', () => {
    const daily = parseFreeformHours('8am-6pm daily');
    const bare = parseFreeformHours('9am-5pm');
    expect(Object.keys(daily!)).toHaveLength(7);
    expect(Object.keys(bare!)).toHaveLength(7);
    expect(daily!['3']).toEqual({ open: '08:00', close: '18:00' });
  });

  it('strips editorial parentheticals and approximation marks', () => {
    expect(parseFreeformHours('Daily ~9am-6pm (verify)')!['0']).toEqual({
      open: '09:00',
      close: '18:00',
    });
  });

  it('records a stated closed day even without a time range', () => {
    const result = parseFreeformHours('By appointment only; closed Mondays');
    expect(result).toEqual({ '1': null });
  });

  it('leaves genuinely indeterminate values unset rather than inventing hours', () => {
    expect(parseFreeformHours('By appointment only')).toBeUndefined();
    expect(parseFreeformHours('24hr hotel')).toBeUndefined();
    expect(parseFreeformHours('By appointment/programme-based')).toBeUndefined();
    expect(parseFreeformHours('')).toBeUndefined();
  });
});

describe('parseOpeningHoursCell', () => {
  it('routes JSON cells through the normaliser', () => {
    expect(parseOpeningHoursCell('{"mon":"10am-6pm"}')).toEqual({
      '1': { open: '10:00', close: '18:00' },
    });
  });

  it('falls back to the free-text parser for non-JSON cells', () => {
    expect(parseOpeningHoursCell('Mon-Sat 10am-6pm')!['6']).toEqual({
      open: '10:00',
      close: '18:00',
    });
  });
});
