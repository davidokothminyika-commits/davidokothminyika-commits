import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stageOutputs, publishStaged, PublishError } from '../../src/publisher/index.js';

describe('publisher', () => {
  let rootDir;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'profile-publisher-'));
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it('stages rendered outputs into the staging directory', async () => {
    const staged = await stageOutputs({
      outputs: [
        { target: 'README.md', content: '# Hello\n' },
        { target: 'assets/generated/banner.svg', content: '<svg></svg>' },
      ],
      stagingDirectory: 'build',
      rootDir,
    });

    expect(staged.stagingDirectory).toBe('build');
    expect(staged.files).toHaveLength(2);
    expect(await readFile(join(rootDir, 'build/README.md'), 'utf8')).toBe('# Hello\n');
    expect(await readFile(join(rootDir, 'build/assets/generated/banner.svg'), 'utf8')).toBe(
      '<svg></svg>',
    );
  });

  it('publishes staged files onto their configured targets', async () => {
    const staged = await stageOutputs({
      outputs: [{ target: 'README.md', content: '# Hello\n' }],
      stagingDirectory: 'build',
      rootDir,
    });
    const published = await publishStaged({ staged, rootDir });

    expect(published.published.map((file) => file.target)).toEqual(['README.md']);
    expect(await readFile(join(rootDir, 'README.md'), 'utf8')).toBe('# Hello\n');
  });

  it('requires a non-empty outputs array with target and content', async () => {
    await expect(stageOutputs({ outputs: [], stagingDirectory: 'build', rootDir })).rejects.toThrow(
      PublishError,
    );
    await expect(
      stageOutputs({ outputs: [{ target: 'README.md' }], stagingDirectory: 'build', rootDir }),
    ).rejects.toThrow(PublishError);
  });

  it('rejects publish targets outside the project root', async () => {
    await expect(
      stageOutputs({
        outputs: [{ target: '../escape.md', content: 'nope' }],
        stagingDirectory: 'build',
        rootDir,
      }),
    ).rejects.toThrow(PublishError);
  });

  it('requires a staged manifest before publishing', async () => {
    await expect(publishStaged({ staged: null, rootDir })).rejects.toThrow(PublishError);
  });

  it('removes partially staged files when a later stage fails', async () => {
    await expect(
      stageOutputs({
        outputs: [
          { target: 'README.md', content: '# Hello\n' },
          { target: '../escape.md', content: 'nope' },
        ],
        stagingDirectory: 'build',
        rootDir,
      }),
    ).rejects.toThrow(PublishError);

    await expect(readFile(join(rootDir, 'build/README.md'), 'utf8')).rejects.toThrow();
  });
});
