import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CONFIG_FILES, PROJECT_ROOT } from '../../src/config/index.js';

/**
 * Create a disposable copy of the real configuration files so each invariant
 * test can change one value without touching the repository.
 */
export function createConfigFixture(mutate) {
  const root = mkdtempSync(join(tmpdir(), 'profile-config-'));
  cpSync(join(PROJECT_ROOT, 'config'), join(root, 'config'), { recursive: true });

  if (mutate) {
    const documents = {};
    for (const [key, relativePath] of Object.entries(CONFIG_FILES)) {
      documents[key] = JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
    }

    mutate(documents);

    for (const [key, relativePath] of Object.entries(CONFIG_FILES)) {
      if (documents[key] !== undefined) {
        writeFileSync(join(root, relativePath), JSON.stringify(documents[key], null, 2));
      }
    }
  }

  return {
    root,
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

export function writeConfigFile(root, key, contents) {
  writeFileSync(join(root, CONFIG_FILES[key]), contents);
}
