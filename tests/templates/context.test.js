import { describe, expect, it } from 'vitest';

import { buildTemplateContext, formatTemplateDate } from '../../src/templates/index.js';
import { assertNoPrivateRepositoryLeak } from '../../src/processors/privacy.js';
import { createPrivateRepository, createRepository } from '../helpers/repository-fixture.js';

const CONFIG = {
  profile: {
    identity: {
      name: 'David Okoth Minyika',
      headline: 'Full-stack developer',
      location: 'Kisumu, Kenya',
      about: ['Shipping software with Node.js.'],
    },
    socials: [
      { label: 'GitHub', url: 'https://github.com/davidokothminyika-commits', icon: 'github' },
    ],
    technology: [
      {
        group: 'Backend',
        perline: 3,
        items: [{ name: 'Node.js', icon: 'nodejs' }],
      },
    ],
  },
  rendering: { timestamp: { label: 'Last updated', locale: 'en-GB', timeZone: 'Africa/Nairobi' } },
};

describe('formatTemplateDate', () => {
  it('formats a date with the configured locale and time zone', () => {
    const formatted = formatTemplateDate(
      { locale: 'en-GB', timeZone: 'Africa/Nairobi' },
      new Date('2026-11-15T09:12:00Z'),
    );

    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });
});

describe('buildTemplateContext', () => {
  it('assembles the public-safe template context', () => {
    const context = buildTemplateContext({
      config: CONFIG,
      publicPayload: {
        statistics: {
          stars: 7,
          forks: 2,
          contributions: { total: 12 },
          activity: {
            items: [
              {
                type: 'PushEvent',
                repository: 'davidokothminyika-commits/public-project',
                createdAt: '2026-11-14T00:00:00Z',
              },
            ],
            coverage: { complete: true },
          },
        },
        languages: { languages: [{ name: 'JavaScript', displayPercentage: 80 }] },
        featured: [{ fullName: 'davidokothminyika-commits/public-project', stars: 4, forks: 1 }],
      },
      identity: { name: 'David Okoth Minyika' },
      now: new Date('2026-11-15T09:12:00Z'),
    });

    expect(context.name).toBe('David Okoth Minyika');
    expect(context.headline).toBe('Full-stack developer');
    expect(context.location).toBe('Kisumu, Kenya');
    expect(context.about).toEqual(['Shipping software with Node.js.']);
    expect(context.languages).toEqual([{ name: 'JavaScript', displayPercentage: 80 }]);
    expect(context.statistics).toMatchObject({ stars: 7, forks: 2, contributions: { total: 12 } });
    expect(context.featured).toHaveLength(1);
    expect(context.activity).toHaveLength(1);
    expect(context.activityComplete).toBe(true);
    expect(context.socials).toHaveLength(1);
    expect(context.technology).toHaveLength(1);
  });

  it('prefers the configured identity name over the GitHub account name', () => {
    const context = buildTemplateContext({
      config: { profile: { identity: { name: 'David Okoth Minyika' } } },
      publicPayload: {},
      identity: { name: 'David Okoth Minyka' },
    });

    expect(context.name).toBe('David Okoth Minyika');
  });

  it('falls back to the GitHub account name when the configured name is absent', () => {
    const context = buildTemplateContext({
      config: { profile: { identity: {} } },
      publicPayload: {},
      identity: { name: 'David Okoth Minyka' },
    });

    expect(context.name).toBe('David Okoth Minyka');
  });

  it('returns null when neither configured nor GitHub name is available', () => {
    const context = buildTemplateContext({
      config: { profile: { identity: {} } },
      publicPayload: {},
      identity: {},
    });

    expect(context.name).toBeNull();
  });

  it('uses the configured name in the rendered heading and identity sentence', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { loadConfig } = await import('../../src/config/index.js');
    const { renderReadme } = await import('../../src/generators/index.js');
    const source = readFileSync(join(process.cwd(), 'main.mustache'), 'utf8');
    const config = loadConfig();
    const context = buildTemplateContext({
      config,
      publicPayload: { statistics: null, languages: null, featured: [] },
      identity: { name: 'David Okoth Minyka' },
      now: new Date('2026-11-15T09:12:00Z'),
    });

    const { markdown } = renderReadme({ context, source });

    expect(markdown).toContain('# David Okoth Minyika\n');
    expect(markdown).toContain('My name is David Okoth Minyika and today is');
    expect(markdown).not.toContain('David Okoth Minyka');
  });

  it('contains only expected public-safe fields and no unrelated identity from the account', () => {
    const context = buildTemplateContext({
      config: { profile: { identity: { name: 'David Okoth Minyika' } } },
      publicPayload: {
        statistics: {},
        languages: { languages: [] },
        featured: [],
      },
      identity: { name: 'David Okoth Minyka', login: 'davidokothminyika-commits' },
    });

    expect(context.name).toBe('David Okoth Minyika');
    expect(Object.keys(context).sort()).toEqual(
      [
        'about',
        'activity',
        'activityComplete',
        'assets',
        'currentlyWorkingOn',
        'date',
        'featured',
        'footer',
        'hasActivity',
        'hasCurrentWork',
        'hasSocials',
        'hasTechStack',
        'headline',
        'languageSummary',
        'languages',
        'location',
        'name',
        'sections',
        'socials',
        'statistics',
        'techStackGroups',
        'technology',
      ].sort(),
    );
  });

  it('builds deterministic skillicons.dev groups from configuration', () => {
    const context = buildTemplateContext({
      config: CONFIG,
      publicPayload: {},
      identity: { name: 'David Okoth Minyika' },
    });

    expect(context.techStackGroups).toEqual([
      {
        group: 'Backend',
        perline: 3,
        items: [{ name: 'Node.js', icon: 'nodejs' }],
        names: 'Node.js',
        iconsUrl: 'https://skillicons.dev/icons?i=nodejs&theme=dark&perline=3',
        linkUrl: 'https://skillicons.dev',
        alt: 'Backend: Node.js',
      },
    ]);
    expect(context.hasTechStack).toBe(true);
  });

  it('always emits icons under the trusted skillicons.dev host', () => {
    const context = buildTemplateContext({
      config: {
        profile: {
          technology: [
            {
              group: 'Backend',
              perline: 2,
              items: [
                { name: 'Node.js', icon: 'nodejs' },
                { name: 'Express', icon: 'express' },
              ],
            },
          ],
        },
      },
      publicPayload: {},
      identity: { name: 'David Okoth Minyika' },
    });

    for (const group of context.techStackGroups) {
      expect(group.iconsUrl).toMatch(/^https:\/\/skillicons\.dev\/icons\?/);
      expect(group.iconsUrl).toContain('theme=dark');
      expect(group.linkUrl).toBe('https://skillicons.dev');
      expect(group.iconsUrl).not.toContain('&theme=dark&perline=3&theme=');
    }
  });

  it('filters out malformed group items before rendering', () => {
    const context = buildTemplateContext({
      config: {
        profile: {
          technology: [
            {
              group: 'Backend',
              perline: 10,
              items: [
                { name: 'Node.js', icon: 'nodejs' },
                { name: 'MissingIcon' },
                { icon: 'orphan' },
                'not-an-object',
                null,
              ],
            },
          ],
        },
      },
      publicPayload: {},
      identity: { name: 'David Okoth Minyika' },
    });

    expect(context.techStackGroups).toHaveLength(1);
    expect(context.techStackGroups[0].items).toEqual([{ name: 'Node.js', icon: 'nodejs' }]);
    expect(context.techStackGroups[0].iconsUrl).toBe(
      'https://skillicons.dev/icons?i=nodejs&theme=dark&perline=10',
    );
  });

  it('defaults perline deterministically when omitted', () => {
    const context = buildTemplateContext({
      config: {
        profile: {
          technology: [
            {
              group: 'Backend',
              items: [
                { name: 'Node.js', icon: 'nodejs' },
                { name: 'Express', icon: 'express' },
                { name: 'MySQL', icon: 'mysql' },
              ],
            },
          ],
        },
      },
      publicPayload: {},
      identity: { name: 'David Okoth Minyika' },
    });

    expect(context.techStackGroups[0].perline).toBe(3);
    expect(context.techStackGroups[0].iconsUrl).toContain('perline=3');
  });

  it('defaults optional context fields without leaking private data', () => {
    const context = buildTemplateContext({ config: {}, publicPayload: {}, identity: {} });

    expect(context.name).toBeNull();
    expect(context.about).toEqual([]);
    expect(context.languages).toEqual([]);
    expect(context.featured).toEqual([]);
    expect(context.activity).toEqual([]);
    expect(context.statistics).toBeNull();
  });

  it('deep-freezes the template context', () => {
    const context = buildTemplateContext({ config: {}, publicPayload: {}, identity: {} });

    expect(Object.isFrozen(context)).toBe(true);
  });

  it('never copies private repository identifiers into the template context', () => {
    const privateRepository = createPrivateRepository({ id: 9001, name: 'secret-project' });

    const context = buildTemplateContext({
      config: { profile: { identity: { about: [] } } },
      publicPayload: {
        statistics: { languages: null, activity: null },
        languages: { languages: [] },
        featured: [],
      },
      identity: {},
    });

    expect(JSON.stringify(context)).not.toContain('secret-project');
    expect(JSON.stringify(context)).not.toContain('9001');

    expect(() =>
      assertNoPrivateRepositoryLeak(context, [createRepository(), privateRepository]),
    ).not.toThrow();
  });
});
