import { describe, expect, it } from 'vitest';

import { mapWithConcurrency } from '../../src/utils/concurrency.js';

describe('mapWithConcurrency', () => {
  it('returns results in input order', async () => {
    const results = await mapWithConcurrency([3, 1, 2], 2, async (value) => {
      await new Promise((resolve) => setTimeout(resolve, value));
      return value * 2;
    });

    expect(results).toEqual([
      { status: 'fulfilled', value: 6 },
      { status: 'fulfilled', value: 2 },
      { status: 'fulfilled', value: 4 },
    ]);
  });

  it('limits the number of in-flight workers', async () => {
    let active = 0;
    let maximum = 0;

    await mapWithConcurrency(
      Array.from({ length: 10 }, (_, index) => index),
      3,
      async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active -= 1;
        return true;
      },
    );

    expect(maximum).toBe(3);
  });

  it('captures failures without rejecting the batch', async () => {
    const results = await mapWithConcurrency([1, 2, 3], 2, async (value) => {
      if (value === 2) throw new Error('boom');
      return value;
    });

    expect(results[0]).toEqual({ status: 'fulfilled', value: 1 });
    expect(results[1].status).toBe('rejected');
    expect(results[1].reason).toBeInstanceOf(Error);
    expect(results[2]).toEqual({ status: 'fulfilled', value: 3 });
  });

  it('handles empty input', async () => {
    await expect(mapWithConcurrency([], 2, async () => 1)).resolves.toEqual([]);
  });

  it('validates arguments', async () => {
    await expect(mapWithConcurrency('nope', 2, async () => 1)).rejects.toThrow(TypeError);
    await expect(mapWithConcurrency([], 0, async () => 1)).rejects.toThrow(RangeError);
    await expect(mapWithConcurrency([], 1, null)).rejects.toThrow(TypeError);
  });
});
