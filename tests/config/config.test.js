import { describe, expect, it } from 'vitest';

import { loadConfig, PROJECT_ROOT, validateConfig } from '../../src/config/index.js';
import { createConfigFixture, writeConfigFile } from '../helpers/config-fixture.js';

describe('loadConfig', () => {
  it('loads and validates the repository configuration', () => {
    const config = loadConfig();

    expect(config.profile.github.username).toBe('davidokothminyika-commits');
    expect(config.profile.github.repository).toBe('davidokothminyika-commits');
    expect(config.collection.visibility).toBe('all');
    expect(config.collection.requireOwnerMatch).toBe(true);
    expect(config.collection.requirePrivateCoverage).toBe(true);
    expect(config.collection.languages).toEqual({
      concurrency: 4,
      includePrivate: true,
      failurePolicy: 'fail',
    });
    expect(config.rendering.assets.threeDimensional.targets).toHaveLength(3);
    expect(config.threeDThemes).toHaveLength(3);
  });

  it('deep-freezes configuration so later phases cannot mutate profile data', () => {
    const config = loadConfig();

    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.profile)).toBe(true);
    expect(Object.isFrozen(config.profile.identity.about)).toBe(true);
    expect(Object.isFrozen(config.rendering.assets.threeDimensional.targets[0])).toBe(true);

    expect(() => {
      config.profile.identity.name = 'Changed';
    }).toThrow(TypeError);
  });

  it('reports invalid JSON with the affected file name', () => {
    const fixture = createConfigFixture();
    try {
      writeConfigFile(fixture.root, 'profile', '{ not json');
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(
        /Invalid JSON in config\/profile\.json/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('reports schema violations with actionable paths', () => {
    const fixture = createConfigFixture((documents) => {
      documents.profile.identity.name = '';
      documents.collection.pagination.perPage = 500;
    });

    try {
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(
        /profile\.identity\.name: Too small: expected string to have >=1 characters/,
      );
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(
        /collection\.pagination\.perPage: Too big/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects a readme path that escapes the repository', () => {
    const fixture = createConfigFixture((documents) => {
      documents.rendering.output.readme = '../README.md';
    });

    try {
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(
        /rendering\.output\.readme: Unsafe relative path/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects a three-dimensional target outside assets/3d', () => {
    const fixture = createConfigFixture((documents) => {
      documents.rendering.assets.threeDimensional.targets[0].target = 'assets/generated/graph.svg';
    });

    try {
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(
        /targets\[0\]\.target must be inside assets\/3d/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects generated graph sources that have no matching theme', () => {
    const fixture = createConfigFixture((documents) => {
      documents.rendering.assets.threeDimensional.targets[0].source = 'unknown.svg';
    });

    try {
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(
        /source "unknown\.svg" has no matching entry/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects a missing required 3D variant', () => {
    const fixture = createConfigFixture((documents) => {
      const target = documents.rendering.assets.threeDimensional.targets.find(
        (candidate) => candidate.variant === 'purple',
      );
      target.variant = 'midnight';
    });

    try {
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(
        /Missing required 3D graph variant: purple/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects duplicate theme filenames', () => {
    const fixture = createConfigFixture((documents) => {
      documents.threeDThemes[1].fileName = documents.threeDThemes[0].fileName;
    });

    try {
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(/Duplicate 3D theme filename/);
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects an invalid time zone', () => {
    const fixture = createConfigFixture((documents) => {
      documents.rendering.timestamp.timeZone = 'Africa/Atlantis';
    });

    try {
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(
        /Invalid timestamp locale or time zone/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects publishing private repository names or language breakdowns', () => {
    const fixture = createConfigFixture((documents) => {
      documents.collection.publish.privateRepositoryNames = true;
    });

    try {
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(
        /Private repository names must never be published/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects a mismatched contact email and mailto social link', () => {
    const fixture = createConfigFixture((documents) => {
      documents.profile.contact.email = 'another@example.com';
    });

    try {
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(
        /profile\.contact\.email must match/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects private coverage requirements when collecting public repositories only', () => {
    const fixture = createConfigFixture((documents) => {
      documents.collection.visibility = 'public';
      documents.collection.requirePrivateCoverage = true;
    });

    try {
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(
        /requirePrivateCoverage cannot be true/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('returns a validated configuration object unchanged', () => {
    const config = structuredClone(loadConfig());
    expect(validateConfig(config, PROJECT_ROOT)).toBe(config);
  });

  it('rejects invalid language collection settings', () => {
    const fixture = createConfigFixture((documents) => {
      documents.collection.languages.concurrency = 0;
      documents.collection.languages.failurePolicy = 'ignore';
    });

    try {
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(
        /collection\.languages\.concurrency: Too small/,
      );
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(
        /collection\.languages\.failurePolicy: Invalid option/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('requires private language aggregation when collecting private repositories only', () => {
    const fixture = createConfigFixture((documents) => {
      documents.collection.visibility = 'private';
      documents.collection.requirePrivateCoverage = true;
      documents.collection.languages.includePrivate = false;
    });

    try {
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(
        /languages\.includePrivate must be true/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('loads the phase four contribution and activity collection defaults', () => {
    const config = loadConfig();

    expect(config.collection.contributions).toEqual({ windowDays: 365, maxRepositories: 100 });
    expect(config.collection.recentActivity).toEqual({ limit: 5, maxAgeDays: 90, maxPages: 3 });
  });

  it('rejects an activity rendering limit above the collected limit', () => {
    const fixture = createConfigFixture((documents) => {
      documents.rendering.layout.recentActivity.limit = 10;
    });

    try {
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(
        /rendering\.layout\.recentActivity\.limit cannot exceed collection\.recentActivity\.limit/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects a featured rendering limit above the curated selection limit', () => {
    const fixture = createConfigFixture((documents) => {
      documents.rendering.layout.featuredRepositories.limit = 5;
    });

    try {
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(
        /rendering\.layout\.featuredRepositories\.limit cannot exceed profile\.featured\.limit/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects invalid contribution collection settings', () => {
    const fixture = createConfigFixture((documents) => {
      documents.collection.contributions.windowDays = 366;
      documents.collection.contributions.maxRepositories = 0;
    });

    try {
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(
        /collection\.contributions\.windowDays: Too big/,
      );
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(
        /collection\.contributions\.maxRepositories: Too small/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects an activity maxPages above the safe feed bound', () => {
    const fixture = createConfigFixture((documents) => {
      documents.collection.recentActivity.maxPages = 21;
    });

    try {
      expect(() => loadConfig({ rootDir: fixture.root })).toThrow(
        /collection\.recentActivity\.maxPages: Too big/,
      );
    } finally {
      fixture.cleanup();
    }
  });
});
