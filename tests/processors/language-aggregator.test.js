import { describe, expect, it } from 'vitest';

import {
  aggregateLanguages,
  AggregationError,
  IncompleteLanguageDataError,
} from '../../src/processors/index.js';

function collection(repositoryId, languages, isPrivate = false) {
  return { repositoryId, private: isPrivate, languages };
}

function displayTotal(result) {
  return Math.round(
    result.languages.reduce((total, language) => total + language.displayPercentage, 0) * 100,
  );
}

describe('aggregateLanguages', () => {
  it('calculates exact byte totals, full-precision percentages and ranks', () => {
    const result = aggregateLanguages({
      collections: [collection(1, { JavaScript: 100, CSS: 25 }), collection(2, { Python: 50 })],
    });

    expect(result.totalBytes).toBe(175);
    expect(result.includedRepositoryCount).toBe(2);
    expect(result.languages.map((language) => language.name)).toEqual([
      'JavaScript',
      'Python',
      'CSS',
    ]);
    expect(result.languages[0]).toMatchObject({ bytes: 100, rank: 1 });
    expect(result.languages[1]).toMatchObject({ bytes: 50, rank: 2 });
    expect(result.languages[2]).toMatchObject({ bytes: 25, rank: 3 });
    expect(result.languages[0].percentage).toBeCloseTo((100 / 175) * 100, 10);
    expect(result.languages[1].percentage).toBeCloseTo((50 / 175) * 100, 10);
    expect(result.languages[0].percentage).not.toBe(result.languages[0].displayPercentage);
    expect(displayTotal(result)).toBe(10000);
  });

  it('does not round before calculating percentages', () => {
    const result = aggregateLanguages({
      collections: [collection(1, { JavaScript: 1, Python: 2 })],
    });

    expect(result.languages[0].percentage).toBeCloseTo(200 / 3, 12);
    expect(result.languages[1].percentage).toBeCloseTo(100 / 3, 12);
  });

  it('uses largest-remainder display rounding so percentages sum to 100.00', () => {
    const result = aggregateLanguages({
      collections: [collection(1, { Aaa: 1, Bbb: 1, Ccc: 1 })],
    });

    expect(result.languages.map((language) => language.displayPercentage)).toEqual([
      33.34, 33.33, 33.33,
    ]);
    expect(displayTotal(result)).toBe(10000);
  });

  it('assigns competition ranks to tied byte counts', () => {
    const result = aggregateLanguages({
      collections: [collection(1, { JavaScript: 100, Python: 100, Go: 50 })],
    });

    expect(result.languages.map((language) => [language.name, language.rank])).toEqual([
      ['JavaScript', 1],
      ['Python', 1],
      ['Go', 3],
    ]);
  });

  it('handles zero total bytes safely', () => {
    const empty = aggregateLanguages({
      collections: [collection(1, {}), collection(2, {})],
    });

    expect(empty).toMatchObject({
      totalBytes: 0,
      languages: [],
      includedRepositoryCount: 2,
    });

    const zeroByteLanguage = aggregateLanguages({
      collections: [collection(1, { JavaScript: 0 })],
    });

    expect(zeroByteLanguage.totalBytes).toBe(0);
    expect(zeroByteLanguage.languages).toEqual([
      {
        name: 'JavaScript',
        bytes: 0,
        percentage: 0,
        displayPercentage: 0,
        rank: 1,
      },
    ]);
    expect(displayTotal(zeroByteLanguage)).toBe(0);
  });

  it('prevents duplicate repository bytes and rejects conflicting duplicates', () => {
    const entry = collection(1, { JavaScript: 100 });
    const result = aggregateLanguages({ collections: [entry, { ...entry }] });

    expect(result.totalBytes).toBe(100);
    expect(result.includedRepositoryCount).toBe(1);
    expect(result.duplicateRepositoryCount).toBe(1);

    expect(() =>
      aggregateLanguages({
        collections: [entry, collection(1, { JavaScript: 200 })],
      }),
    ).toThrow(AggregationError);
    expect(() =>
      aggregateLanguages({
        collections: [entry, collection(1, { JavaScript: 200 })],
      }),
    ).toThrow(/conflicting records/);
  });

  it('aggregates public and private repositories together while keeping counts', () => {
    const result = aggregateLanguages({
      collections: [
        collection(1, { JavaScript: 100 }, false),
        collection(2, { Python: 100 }, true),
      ],
    });

    expect(result.totalBytes).toBe(200);
    expect(result.publicRepositoryCount).toBe(1);
    expect(result.privateRepositoryCount).toBe(1);
    expect(result.languages.map((language) => language.displayPercentage)).toEqual([50, 50]);
  });

  it('refuses incomplete language data by default', () => {
    expect(() =>
      aggregateLanguages({
        collections: [collection(1, { JavaScript: 100 })],
        failures: [{ repositoryId: 2, private: true, code: 'GITHUB_FORBIDDEN' }],
      }),
    ).toThrow(IncompleteLanguageDataError);

    expect(() =>
      aggregateLanguages({
        collections: [collection(1, { JavaScript: 100 })],
        coverage: { complete: false },
      }),
    ).toThrow(IncompleteLanguageDataError);
  });

  it('can aggregate incomplete data only when explicitly allowed for diagnostics', () => {
    const result = aggregateLanguages({
      collections: [collection(1, { JavaScript: 100 })],
      failures: [{ repositoryId: 2, private: true, code: 'GITHUB_FORBIDDEN' }],
      allowIncomplete: true,
    });

    expect(result.totalBytes).toBe(100);
    expect(result.incomplete).toBe(true);
  });

  it('rejects invalid repository identities and byte counts', () => {
    expect(() =>
      aggregateLanguages({
        collections: [collection(0, { JavaScript: 1 })],
      }),
    ).toThrow(/invalid repository identity/);

    expect(() =>
      aggregateLanguages({
        collections: [collection(1, { JavaScript: -1 })],
      }),
    ).toThrow(/invalid byte counts/);

    expect(() =>
      aggregateLanguages({
        collections: [collection(1, { JavaScript: Number.MAX_SAFE_INTEGER + 1 })],
      }),
    ).toThrow(/invalid byte counts/);
  });

  it('detects safe-integer overflow across repositories', () => {
    expect(() =>
      aggregateLanguages({
        collections: [
          collection(1, { JavaScript: Number.MAX_SAFE_INTEGER }),
          collection(2, { JavaScript: Number.MAX_SAFE_INTEGER }),
        ],
      }),
    ).toThrow(/safe integer range/);
  });

  it('validates the collections argument', () => {
    expect(() => aggregateLanguages({})).toThrow(TypeError);
    expect(() => aggregateLanguages({ collections: [], failures: 'no' })).toThrow(TypeError);
  });
});
