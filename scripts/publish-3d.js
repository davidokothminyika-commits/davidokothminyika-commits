#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig, PROJECT_ROOT } from '../src/config/index.js';
import { stageOutputs, publishStaged, PublishError } from '../src/publisher/index.js';
import { validateSvg } from '../src/generators/index.js';

try {
  const config = loadConfig();

  const threeDimensional = config.rendering.assets.threeDimensional;
  const outputs = [];

  for (const target of threeDimensional.targets) {
    const sourcePath = join(PROJECT_ROOT, threeDimensional.generatorOutputDirectory, target.source);

    let content;
    try {
      content = await readFile(sourcePath, 'utf8');
    } catch {
      throw new PublishError(
        `Generated 3D contribution graph for variant "${target.variant}" was not found. ` +
          `Run the upstream 3D action first; it writes the generated SVGs into ${threeDimensional.generatorOutputDirectory}/.`,
      );
    }
    // Validate the non-empty SVG structure only: the upstream action renders
    // colours with its own casing, so an exact colour match is not reliable.
    const validation = validateSvg({ svg: content });
    if (!validation.valid) {
      throw new PublishError(
        `Generated 3D contribution graph (${target.variant}) failed validation: ${validation.errors.join('; ')}`,
      );
    }

    outputs.push({ target: target.target, content });
  }

  const staged = await stageOutputs({
    outputs,
    stagingDirectory: config.output.stagingDirectory,
    rootDir: PROJECT_ROOT,
  });
  const published = await publishStaged({ staged, rootDir: PROJECT_ROOT });

  console.log('3D contribution graph publish complete.');
  for (const file of published.published) {
    console.log(`  Published: ${file.target}`);
  }
} catch (error) {
  console.error(`${error.name}: ${error.message}`);
  process.exitCode = 1;
}
