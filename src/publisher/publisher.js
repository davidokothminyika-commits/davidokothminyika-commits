import { mkdir, rm, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PROJECT_ROOT } from '../config/index.js';
import { resolveWithin } from '../utils/paths.js';
import { deepFreeze } from '../utils/freeze.js';
import { silentLogger } from '../utils/logger.js';

export class PublishError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PublishError';
  }
}

function requireOutputs(outputs) {
  if (!Array.isArray(outputs) || outputs.length === 0) {
    throw new PublishError('Publishing requires at least one output to stage');
  }

  for (const output of outputs) {
    if (!output || typeof output.target !== 'string' || typeof output.content !== 'string') {
      throw new PublishError('Every staged output requires a target path and string content');
    }
  }

  return outputs;
}

/**
 * Stage rendered public outputs into the configured staging directory.
 *
 * Staging is fail-closed: the staging directory is scratch space (git-ignored
 * by convention) and partial writes are removed again when a stage fails, so a
 * failed run never leaves half-written output behind for a later publish.
 */
export async function stageOutputs({
  outputs,
  stagingDirectory,
  rootDir = PROJECT_ROOT,
  logger = silentLogger,
} = {}) {
  const safeOutputs = requireOutputs(outputs);
  const files = [];

  try {
    for (const output of safeOutputs) {
      const stagedPath = resolveWithin(rootDir, `${stagingDirectory}/${output.target}`);

      await mkdir(dirname(stagedPath), { recursive: true });
      await writeFile(stagedPath, output.content, 'utf8');
      files.push({ target: output.target, stagedPath });
    }
  } catch (error) {
    // Fail closed: remove partially staged files so a failed run leaves no
    // half-written output behind for a later publish.
    await Promise.all(
      files.map((file) => rm(file.stagedPath, { force: true }).catch(() => undefined)),
    );
    throw new PublishError(`Unable to stage published outputs: ${error.message}`);
  }

  logger.info(`Staged ${files.length} output file(s) in ${stagingDirectory}.`);

  return deepFreeze({ stagingDirectory, files });
}

/**
 * Publish staged outputs by moving each staged file onto its configured
 * target. Moves are atomic within a filesystem, and publishing only runs after
 * content validation succeeded in the calling stage, so an invalid or incomplete
 * run never overwrites a previously published asset.
 */
export async function publishStaged({
  staged,
  rootDir = PROJECT_ROOT,
  logger = silentLogger,
} = {}) {
  if (!staged || !Array.isArray(staged.files) || staged.files.length === 0) {
    throw new PublishError('Publishing requires a staged output manifest');
  }

  const published = [];

  try {
    for (const file of staged.files) {
      const targetPath = resolveWithin(rootDir, file.target);
      await rename(file.stagedPath, targetPath);
      published.push({ target: file.target, stagedPath: file.stagedPath });
    }
  } catch (error) {
    throw new PublishError(`Unable to publish staged outputs: ${error.message}`);
  }

  logger.info(`Published ${published.length} output file(s).`);

  return deepFreeze({ published });
}
