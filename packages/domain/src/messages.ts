import { z } from 'zod';

import {
  activeSquadVisibleEventSchema,
  adapterDegradedEventSchema,
  cardSelectedEventSchema,
  cardsVisibleEventSchema,
  duplicateDetectedEventSchema,
  marketContextVisibleEventSchema,
  packResultVisibleEventSchema,
  playerPickVisibleEventSchema,
  sbcContextVisibleEventSchema,
  type NormalizedAdapterEvent,
  visibleCardSchema,
} from './adapter-events';
import { isoDateTimeSchema } from './common';

const adapterReadyEventSchema = z.union([
  cardSelectedEventSchema,
  cardsVisibleEventSchema,
  activeSquadVisibleEventSchema,
  packResultVisibleEventSchema,
  playerPickVisibleEventSchema,
  duplicateDetectedEventSchema,
  sbcContextVisibleEventSchema,
  marketContextVisibleEventSchema,
]);

export const adapterSnapshotSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('ready'),
    updatedAt: isoDateTimeSchema,
    event: adapterReadyEventSchema,
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
  event: z.union([adapterReadyEventSchema, adapterDegradedEventSchema]),
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

export const protectionStatusRequestMessageSchema = z.object({
  kind: z.literal('protection.status.request'),
  card: visibleCardSchema,
});

export const protectionStatusResponseSchema = z.object({
  kind: z.literal('protection.status'),
  status: z.enum(['protected', 'clear', 'ambiguous']),
  tagNames: z.array(z.string().min(1)),
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

  if (
    event.type === 'cards.visible' ||
    event.type === 'activeSquad.visible' ||
    event.type === 'packResult.visible' ||
    event.type === 'playerPick.visible' ||
    event.type === 'duplicate.detected' ||
    event.type === 'sbcContext.visible' ||
    event.type === 'marketContext.visible'
  ) {
    return {
      state: 'ready',
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
