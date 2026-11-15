/**
 * Recursively freeze an object graph created by this project. Avoids copying:
 * callers own the freshly built value. Used for public summaries so later
 * rendering stages cannot mutate published statistics.
 */
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}
