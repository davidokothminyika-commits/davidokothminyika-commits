import { describe, expect, it } from 'vitest';

import {
  addDays,
  assertDateString,
  compareDateStrings,
  countDaysInclusive,
  dateStringToUtcTimestamp,
  isValidDateString,
  toDateString,
} from '../../src/utils/dates.js';

describe('date utilities', () => {
  it('accepts real calendar dates only', () => {
    expect(isValidDateString('2024-02-29')).toBe(true);
    expect(isValidDateString('2026-02-29')).toBe(false);
    expect(isValidDateString('2026-13-01')).toBe(false);
    expect(isValidDateString('2026-00-10')).toBe(false);
    expect(isValidDateString('2026-04-31')).toBe(false);
    expect(isValidDateString('2026-1-1')).toBe(false);
    expect(isValidDateString('26-01-01')).toBe(false);
    expect(isValidDateString('20260101')).toBe(false);
    expect(isValidDateString(null)).toBe(false);
  });

  it('throws for invalid dates and accepts real calendar dates', () => {
    expect(() => assertDateString('2026-02-30')).toThrow(TypeError);
    expect(() => assertDateString('2026-02-29', 'reference date')).toThrow(TypeError);
    expect(() => assertDateString('2026-02-28', 'reference date')).not.toThrow();
  });

  it('converts date strings to UTC timestamps and back', () => {
    expect(dateStringToUtcTimestamp('2024-02-29')).toBe(Date.UTC(2024, 1, 29));
    expect(dateStringToUtcTimestamp('2026-02-28')).toBe(Date.UTC(2026, 1, 28));
    expect(() => dateStringToUtcTimestamp('2026-02-30')).toThrow(TypeError);
    expect(toDateString(new Date(Date.UTC(2026, 1, 28)))).toBe('2026-02-28');
    expect(() => toDateString(new Date('invalid'))).toThrow(TypeError);
  });

  it('adds whole days without crossing a DST boundary in UTC', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-03-01', 1)).toBe('2026-03-02');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(() => addDays('2026-02-30', 1)).toThrow(TypeError);
    expect(() => addDays('2026-02-28', 1.5)).toThrow(TypeError);
  });

  it('orders and counts date ranges inclusively', () => {
    expect(compareDateStrings('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareDateStrings('2026-01-02', '2026-01-01')).toBe(1);
    expect(compareDateStrings('2026-01-01', '2026-01-01')).toBe(0);
    expect(() => compareDateStrings('2026-1-1', '2026-01-02')).toThrow(TypeError);

    expect(countDaysInclusive('2026-01-01', '2026-01-01')).toBe(1);
    expect(countDaysInclusive('2026-01-01', '2026-01-02')).toBe(2);
    expect(countDaysInclusive('2026-12-31', '2026-01-01')).toBe(0);
    expect(() => countDaysInclusive('2026-01-01', '2026-01-32')).toThrow(TypeError);
  });
});
