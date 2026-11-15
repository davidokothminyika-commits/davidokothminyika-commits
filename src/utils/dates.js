const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function parts(dateString) {
  const match = DATE_PATTERN.exec(dateString);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

/**
 * True only for a real calendar date in `YYYY-MM-DD` form. GitHub contribution
 * calendars return date-only values; rejecting impossible dates prevents streak
 * arithmetic from producing misleading results.
 */
export function isValidDateString(value) {
  return typeof value === 'string' && parts(value) !== null;
}

export function assertDateString(value, label = 'date') {
  if (!isValidDateString(value)) {
    throw new TypeError(`${label} must be a valid YYYY-MM-DD date`);
  }
  return value;
}

export function dateStringToUtcTimestamp(value) {
  assertDateString(value);
  const { year, month, day } = parts(value);
  return Date.UTC(year, month - 1, day);
}

export function toDateString(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('Expected a valid Date');
  }
  return date.toISOString().slice(0, 10);
}

export function addDays(dateString, days) {
  assertDateString(dateString);
  if (!Number.isInteger(days)) {
    throw new TypeError('days must be an integer');
  }
  const timestamp = dateStringToUtcTimestamp(dateString) + days * DAY_MS;
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function compareDateStrings(left, right) {
  assertDateString(left, 'left date');
  assertDateString(right, 'right date');
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function countDaysInclusive(fromDateString, toDateStringValue) {
  const from = dateStringToUtcTimestamp(assertDateString(fromDateString, 'from date'));
  const to = dateStringToUtcTimestamp(assertDateString(toDateStringValue, 'to date'));
  const difference = to - from;
  if (difference < 0) return 0;
  return Math.round(difference / DAY_MS) + 1;
}

export { DAY_MS };
