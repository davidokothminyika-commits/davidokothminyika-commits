import { isAbsolute, relative, resolve, sep, win32 } from 'node:path';

export class PathSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PathSafetyError';
  }
}

/**
 * Return true only for a non-empty relative path that cannot escape a root
 * directory and does not rely on shell-specific expansions.
 */
export function isSafeRelativePath(candidate) {
  if (typeof candidate !== 'string') return false;
  if (candidate.trim() === '' || candidate.includes('\0')) return false;
  if (isAbsolute(candidate) || win32.isAbsolute(candidate) || candidate.startsWith('~')) {
    return false;
  }

  const segments = candidate.split(/[\\/]+/);
  return segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

/**
 * Resolve a configured path inside a trusted root. Throws when the path is
 * absolute, traverses upwards, or resolves outside the root after symlink-free
 * path normalisation.
 */
export function resolveWithin(rootDir, relativePath) {
  if (!isSafeRelativePath(relativePath)) {
    throw new PathSafetyError(`Unsafe relative path: ${String(relativePath)}`);
  }

  const root = resolve(rootDir);
  const target = resolve(root, relativePath);
  const rel = relative(root, target);

  if (rel === '' || rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) {
    throw new PathSafetyError(`Path escapes the project root: ${relativePath}`);
  }

  return target;
}
