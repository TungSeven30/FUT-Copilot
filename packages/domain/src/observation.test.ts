import { createObservationSchema } from './observation';
import { z } from 'zod';

const observedAt = '2026-08-01T15:00:00.000Z';
const ratingObservationSchema = createObservationSchema(
  z.number().int().min(1).max(99),
);

describe('observation schema', () => {
  it.each(['known', 'inferred', 'stale'] as const)(
    'keeps %s distinct and requires a value',
    (status) => {
      const result = ratingObservationSchema.parse({
        value: 91,
        source: 'ea-visible-ui',
        observedAt,
        status,
      });

      expect(result.status).toBe(status);
      expect(result.value).toBe(91);
    },
  );

  it('represents unknown as an explicit null value', () => {
    const result = ratingObservationSchema.parse({
      value: null,
      source: 'ea-visible-ui',
      observedAt,
      status: 'unknown',
    });

    expect(result.status).toBe('unknown');
    expect(result.value).toBeNull();
  });

  it('rejects contradictory status and value combinations', () => {
    expect(() =>
      ratingObservationSchema.parse({
        value: null,
        source: 'ea-visible-ui',
        observedAt,
        status: 'known',
      }),
    ).toThrow();

    expect(() =>
      ratingObservationSchema.parse({
        value: 91,
        source: 'ea-visible-ui',
        observedAt,
        status: 'unknown',
      }),
    ).toThrow();
  });
});
