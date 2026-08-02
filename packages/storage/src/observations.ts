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
  const eventTime = new Date(event.occurredAt).getTime();
  const eventSignature = createAdapterEventSignature(event);
  const repeatedEvent = sameType.find((candidate) => {
    const elapsed = eventTime - new Date(candidate.occurredAt).getTime();
    return (
      elapsed >= 0 &&
      elapsed <= DEDUPLICATION_WINDOW_MS &&
      createAdapterEventSignature(candidate) === eventSignature
    );
  });
  const persisted = normalizedAdapterEventSchema.parse(
    repeatedEvent === undefined
      ? event
      : { ...event, eventId: repeatedEvent.eventId },
  );

  await database.observations.put(persisted);
  return {
    event: persisted,
    status: repeatedEvent === undefined ? 'created' : 'updated',
  };
}
