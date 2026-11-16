import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadConfig } from '../../src/config/index.js';
import {
  resolvePublishTargets,
  resolveThreeDimensionalPublish,
  PublishError,
} from '../../src/publisher/index.js';

const PROJECT_ROOT = process.cwd();

describe('resolvePublishTargets', () => {
  it('resolves every publish target from the validated rendering config', () => {
    const config = loadConfig();

    expect(resolvePublishTargets(config)).toEqual({
      readme: 'README.md',
      banner: 'assets/generated/banner.svg',
      languageChart: 'assets/generated/languages.svg',
      stagingDirectory: 'build',
    });
  });

  it('never resolves from outdated top-level config domains', () => {
    const config = loadConfig();

    // The top-level domains do not exist; the validated shape is nested under
    // `rendering`. A script that reads config.output.readme would crash here.
    expect(config.output).toBeUndefined();
    expect(config.assets).toBeUndefined();
    expect(resolvePublishTargets(config).readme).not.toBeUndefined();
  });

  it('rejects missing rendering configuration', () => {
    expect(() => resolvePublishTargets({})).toThrow(PublishError);
    expect(() => resolvePublishTargets(null)).toThrow(PublishError);
    expect(() => resolvePublishTargets({ rendering: { output: { readme: 'README.md' } } })).toThrow(
      PublishError,
    );
  });
});

describe('resolveThreeDimensionalPublish', () => {
  it('resolves generator output, targets and staging from the validated config', () => {
    const config = loadConfig();

    expect(resolveThreeDimensionalPublish(config)).toEqual({
      generatorOutputDirectory: 'profile-3d-contrib',
      targets: config.rendering.assets.threeDimensional.targets,
      stagingDirectory: 'build',
    });
  });

  it('rejects missing three-dimensional configuration', () => {
    expect(() => resolveThreeDimensionalPublish({})).toThrow(PublishError);
    expect(() =>
      resolveThreeDimensionalPublish({ rendering: { assets: { threeDimensional: null } } }),
    ).toThrow(PublishError);
    expect(() =>
      resolveThreeDimensionalPublish({
        rendering: { assets: { threeDimensional: { generatorOutputDirectory: 'x', targets: [] } } },
      }),
    ).toThrow(PublishError);
  });
});

describe('publish script configuration wiring', () => {
  const publishScript = readFileSync(join(PROJECT_ROOT, 'scripts', 'publish.js'), 'utf8');
  const publishThreeDimensionalScript = readFileSync(
    join(PROJECT_ROOT, 'scripts', 'publish-3d.js'),
    'utf8',
  );

  it('the main publisher uses the shared configuration resolver', () => {
    expect(publishScript).toContain('resolvePublishTargets');
    expect(publishScript).not.toMatch(/config\.output\b/);
    expect(publishScript).not.toMatch(/config\.assets\b/);
  });

  it('the 3D publisher uses the shared configuration resolver', () => {
    expect(publishThreeDimensionalScript).toContain('resolveThreeDimensionalPublish');
    expect(publishThreeDimensionalScript).not.toMatch(/config\.output\b/);
    expect(publishThreeDimensionalScript).not.toMatch(/config\.assets\b(?!\.threeDimensional)/);
  });
});
