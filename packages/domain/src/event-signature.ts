import type { NormalizedAdapterEvent } from './adapter-events';

const VOLATILE_KEYS = new Set([
  'eventId',
  'occurredAt',
  'observedAt',
  'localObservationId',
]);

function canonicalize(value: unknown, parentKey = ''): unknown {
  if (Array.isArray(value)) {
    const normalized = value.map((entry) => canonicalize(entry));
    return parentKey === 'reasonCodes'
      ? normalized.sort((left, right) =>
          JSON.stringify(left).localeCompare(JSON.stringify(right)),
        )
      : normalized;
  }
  if (typeof value !== 'object' || value === null) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !VOLATILE_KEYS.has(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry, key)]),
  );
}

export function createAdapterEventSignature(
  event: NormalizedAdapterEvent,
): string {
  return JSON.stringify(canonicalize(event));
}
