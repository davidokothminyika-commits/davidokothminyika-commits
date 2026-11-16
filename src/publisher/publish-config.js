import { deepFreeze } from '../utils/freeze.js';
import { PublishError } from './publisher.js';

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new PublishError(`Invalid configuration: ${label} must be a non-empty string`);
  }
  return value;
}

function requireRendering(config) {
  const rendering = config?.rendering;
  if (!rendering || typeof rendering !== 'object') {
    throw new PublishError('Invalid configuration: missing the rendering section');
  }
  return rendering;
}

/**
 * Resolve the validated output targets for the main profile publisher.
 *
 * Centralises the config shape so both the CLI publisher and the regression
 * tests rely on one definition of where the README, banner and language chart
 * live.
 */
export function resolvePublishTargets(config) {
  const rendering = requireRendering(config);
  const output = rendering.output;
  const assets = rendering.assets;

  if (!output || typeof output !== 'object') {
    throw new PublishError('Invalid configuration: missing rendering.output');
  }
  if (!assets || typeof assets !== 'object') {
    throw new PublishError('Invalid configuration: missing rendering.assets');
  }

  return deepFreeze({
    readme: requireString(output.readme, 'rendering.output.readme'),
    banner: requireString(assets.banner, 'rendering.assets.banner'),
    languageChart: requireString(assets.languageChart, 'rendering.assets.languageChart'),
    techStack: requireString(assets.techStack, 'rendering.assets.techStack'),
    stagingDirectory: requireString(output.stagingDirectory, 'rendering.output.stagingDirectory'),
  });
}

/**
 * Resolve the validated configuration for the 3D contribution graph publisher.
 *
 * Centralises the config shape used by `publish-3d.js` so the staging
 * directory and three-dimensional targets have a single definition.
 */
export function resolveThreeDimensionalPublish(config) {
  const rendering = requireRendering(config);
  const threeDimensional = rendering.assets?.threeDimensional;
  if (
    !threeDimensional ||
    typeof threeDimensional !== 'object' ||
    !Array.isArray(threeDimensional.targets) ||
    threeDimensional.targets.length === 0
  ) {
    throw new PublishError(
      'Invalid configuration: missing rendering.assets.threeDimensional targets',
    );
  }

  return deepFreeze({
    generatorOutputDirectory: requireString(
      threeDimensional.generatorOutputDirectory,
      'rendering.assets.threeDimensional.generatorOutputDirectory',
    ),
    targets: threeDimensional.targets,
    stagingDirectory: requireString(
      rendering.output?.stagingDirectory,
      'rendering.output.stagingDirectory',
    ),
  });
}
