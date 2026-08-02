import {
  normalizedAdapterEventSchema,
  type NormalizedAdapterEvent,
} from '@fut-copilot/domain/adapter-events';
import { createAdapterEventSignature } from '@fut-copilot/domain/event-signature';

import type { FutCopilotDatabase } from './database';

export type PersistedAdapterEvent = {
  event: NormalizedAdapterEvent;
  status: 'created' | 'updated';
};

const DEDUPLICATION_WINDOW_MS = 5 * 60 * 1_000;

export async function persistNormalizedAdapterEvent(
  database: FutCopilotDatabase,
  input: NormalizedAdapterEvent,
): Promise<PersistedAdapterEvent> {
  const event = normalizedAdapterEventSchema.parse(input);
  const sameType = (
    await database.observations.where('type').equals(event.type).toArray()
  )
    .map((candidate) => normalizedAdapterEventSchema.parse(candidate))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  const latest = sameType[0];
  const elapsedSinceLatest =
    latest === undefined
      ? Number.POSITIVE_INFINITY
      : new Date(event.occurredAt).getTime() -
        new Date(latest.occurredAt).getTime();
  const repeated =
    latest !== undefined &&
    elapsedSinceLatest >= 0 &&
    elapsedSinceLatest <= DEDUPLICATION_WINDOW_MS &&
    createAdapterEventSignature(latest) === createAdapterEventSignature(event);
  const persisted = normalizedAdapterEventSchema.parse(
    repeated ? { ...event, eventId: latest.eventId } : event,
  );

  await database.observations.put(persisted);
  return { event: persisted, status: repeated ? 'updated' : 'created' };
}
