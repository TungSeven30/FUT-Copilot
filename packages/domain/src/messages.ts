import { z } from 'zod';

import {
  adapterDegradedEventSchema,
  cardSelectedEventSchema,
  type NormalizedAdapterEvent,
} from './adapter-events';
import { isoDateTimeSchema } from './common';

export const adapterSnapshotSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('ready'),
    updatedAt: isoDateTimeSchema,
    event: cardSelectedEventSchema,
  }),
  z.object({
    state: z.literal('empty'),
    updatedAt: isoDateTimeSchema,
    event: cardSelectedEventSchema,
  }),
  z.object({
    state: z.literal('degraded'),
    updatedAt: isoDateTimeSchema,
    event: adapterDegradedEventSchema,
  }),
  z.object({
    state: z.literal('unsupported'),
    updatedAt: isoDateTimeSchema,
    event: adapterDegradedEventSchema,
  }),
]);

export const adapterEventMessageSchema = z.object({
  kind: z.literal('adapter.event'),
  event: z.union([cardSelectedEventSchema, adapterDegradedEventSchema]),
});

export const adapterSnapshotGetMessageSchema = z.object({
  kind: z.literal('adapter.snapshot.get'),
});

export const adapterObserveRequestMessageSchema = z.object({
  kind: z.literal('adapter.observe.request'),
});

export const adapterObserveNowMessageSchema = z.object({
  kind: z.literal('adapter.observe.now'),
});

export const adapterSnapshotChangedMessageSchema = z.object({
  kind: z.literal('adapter.snapshot.changed'),
  snapshot: adapterSnapshotSchema,
});

export const adapterSnapshotResponseSchema = z.object({
  kind: z.literal('adapter.snapshot'),
  snapshot: adapterSnapshotSchema.nullable(),
});

export const adapterAcknowledgeResponseSchema = z.object({
  kind: z.literal('adapter.ack'),
  accepted: z.boolean(),
  reason: z.string().min(1).optional(),
});

export function createAdapterSnapshot(
  event: NormalizedAdapterEvent,
): z.infer<typeof adapterSnapshotSchema> | null {
  if (event.type === 'card.selected') {
    return {
      state: event.payload.card === null ? 'empty' : 'ready',
      updatedAt: event.occurredAt,
      event,
    };
  }

  if (event.type === 'adapter.degraded') {
    return {
      state: event.payload.screen === 'unknown' ? 'unsupported' : 'degraded',
      updatedAt: event.occurredAt,
      event,
    };
  }

  return null;
}

export type AdapterSnapshot = z.infer<typeof adapterSnapshotSchema>;
export type AdapterEventMessage = z.infer<typeof adapterEventMessageSchema>;
export type AdapterSnapshotResponse = z.infer<
  typeof adapterSnapshotResponseSchema
>;
