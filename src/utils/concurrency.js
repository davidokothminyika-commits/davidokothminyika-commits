/**
 * Map over items with a fixed maximum number of in-flight workers.
 *
 * Results are returned in input order. A worker failure is captured in that
 * item's slot rather than rejecting the whole batch, so callers can apply an
 * explicit collection failure policy. Argument errors are thrown immediately.
 */
export async function mapWithConcurrency(items, concurrency, mapper) {
  if (!Array.isArray(items)) {
    throw new TypeError('items must be an array');
  }
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError('concurrency must be a positive integer');
  }
  if (typeof mapper !== 'function') {
    throw new TypeError('mapper must be a function');
  }
  if (items.length === 0) return [];

  const results = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;

      try {
        results[index] = { status: 'fulfilled', value: await mapper(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  return results;
}
