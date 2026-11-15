import { describe, expect, it } from 'vitest';

import { createThreeDimensionalSettings } from '../../src/generators/index.js';

const THEMES = [
  {
    type: 'normal',
    fileName: 'profile-3d-contrib.svg',
    backgroundColor: '#070b16',
    foregroundColor: '#e2e8f0',
    strongColor: '#22d3ee',
    weakColor: '#334155',
    radarColor: '#34d399',
    growingAnimation: false,
    contribColors: ['#111c31', '#164e63', '#0e7490', '#06b6d4', '#22d3ee'],
  },
];

describe('createThreeDimensionalSettings', () => {
  it('creates one settings entry per theme with documented fields', () => {
    const settings = createThreeDimensionalSettings({
      themes: THEMES,
      username: 'davidokothminyika-commits',
    });

    expect(settings).toHaveLength(1);
    expect(settings[0]).toMatchObject({
      type: 'normal',
      fileName: 'profile-3d-contrib.svg',
      backgroundColor: '#070b16',
      foregroundColor: '#e2e8f0',
      strongColor: '#22d3ee',
      weakColor: '#334155',
      radarColor: '#34d399',
      growingAnimation: false,
      contribColors: THEMES[0].contribColors,
    });
  });

  it('forwards optional repository cap and contribution year', () => {
    const withOptions = createThreeDimensionalSettings({
      themes: THEMES,
      username: 'davidokothminyika-commits',
      maxRepositories: 25,
      year: 2026,
    });
    const withoutOptions = createThreeDimensionalSettings({
      themes: THEMES,
      username: 'davidokothminyika-commits',
    });

    expect(withOptions[0]).toMatchObject({ maxRepositories: 25, year: 2026 });
    expect(withoutOptions[0]).not.toHaveProperty('maxRepositories');
    expect(withoutOptions[0]).not.toHaveProperty('year');
  });

  it('rejects invalid inputs', () => {
    expect(() => createThreeDimensionalSettings({ themes: [], username: 'user' })).toThrow(
      TypeError,
    );
    expect(() => createThreeDimensionalSettings({ themes: THEMES, username: '' })).toThrow(
      TypeError,
    );
  });
});
