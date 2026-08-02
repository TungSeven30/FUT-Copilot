import { z } from 'zod';

import { confidenceSchema, isoDateTimeSchema, localIdSchema } from './common';
import {
  createObservationSchema,
  stringObservationSchema,
} from './observation';

export const screenKindSchema = z.enum([
  'active-squad',
  'club',
  'selected-card',
  'pack-result',
  'player-pick',
  'duplicate',
  'sbc',
  'transfer-market',
  'transfer-list',
  'unknown',
]);

export const visibleCardSchema = z.object({
  localObservationId: localIdSchema,
  name: stringObservationSchema,
  overall: createObservationSchema(z.number().int().min(1).max(99)),
  position: stringObservationSchema,
  club: stringObservationSchema,
  league: stringObservationSchema,
  nation: stringObservationSchema,
  rarity: stringObservationSchema,
  tradeability: createObservationSchema(
    z.enum(['tradeable', 'untradeable', 'unknown']),
  ),
  firstOwner: createObservationSchema(z.boolean()),
  loan: createObservationSchema(z.boolean()),
  faceStats: z
    .array(
      z.object({
        label: z.enum([
          'PAC',
          'SHO',
          'PAS',
          'DRI',
          'DEF',
          'PHY',
          'DIV',
          'HAN',
          'KIC',
          'REF',
          'SPD',
          'POS',
        ]),
        value: z.number().int().min(0).max(99),
      }),
    )
    .max(6),
});

export const squadSlotSchema = z.object({
  slot: z.string().min(1),
  group: z.enum(['starting', 'bench', 'reserves']),
  card: visibleCardSchema.nullable(),
});

const eventBase = {
  eventVersion: z.literal(1),
  eventId: localIdSchema,
  webAppBuild: stringObservationSchema,
  occurredAt: isoDateTimeSchema,
  confidence: confidenceSchema,
  extractionStatus: z.enum(['known', 'inferred', 'unknown', 'stale']),
  adapterVersion: z.string().min(1),
};

const screenChangedEventSchema = z.object({
  ...eventBase,
  type: z.literal('screen.changed'),
  payload: z.object({
    current: screenKindSchema,
    previous: screenKindSchema.nullable(),
  }),
});

export const cardSelectedEventSchema = z.object({
  ...eventBase,
  type: z.literal('card.selected'),
  payload: z.object({
    screen: screenKindSchema,
    card: visibleCardSchema.nullable(),
  }),
});

export const cardsVisibleEventSchema = z.object({
  ...eventBase,
  type: z.literal('cards.visible'),
  payload: z.object({
    context: screenKindSchema,
    cards: z.array(visibleCardSchema),
  }),
});

export const activeSquadVisibleEventSchema = z.object({
  ...eventBase,
  type: z.literal('activeSquad.visible'),
  payload: z.object({ slots: z.array(squadSlotSchema).max(23) }),
});

export const packResultVisibleEventSchema = z
  .object({
    ...eventBase,
    type: z.literal('packResult.visible'),
    payload: z.object({
      cards: z.array(visibleCardSchema).min(1),
      duplicateIndexes: z.array(z.number().int().nonnegative()).default([]),
    }),
  })
  .superRefine((event, context) => {
    const duplicateIndexes = event.payload.duplicateIndexes;
    if (new Set(duplicateIndexes).size !== duplicateIndexes.length) {
      context.addIssue({
        code: 'custom',
        path: ['payload', 'duplicateIndexes'],
        message: 'Pack-result duplicate indexes must be unique.',
      });
    }
    for (const [index, duplicateIndex] of duplicateIndexes.entries()) {
      if (duplicateIndex >= event.payload.cards.length) {
        context.addIssue({
          code: 'custom',
          path: ['payload', 'duplicateIndexes', index],
          message: 'Pack-result duplicate index must identify a visible card.',
        });
      }
      if (index > 0 && duplicateIndex <= (duplicateIndexes[index - 1] ?? -1)) {
        context.addIssue({
          code: 'custom',
          path: ['payload', 'duplicateIndexes', index],
          message: 'Pack-result duplicate indexes must preserve visible order.',
        });
      }
    }
  });

export const playerPickVisibleEventSchema = z
  .object({
    ...eventBase,
    type: z.literal('playerPick.visible'),
    payload: z.object({
      options: z.array(visibleCardSchema).min(1),
      selectedIndex: z.number().int().nonnegative().nullable(),
    }),
  })
  .superRefine((event, context) => {
    if (
      event.payload.selectedIndex !== null &&
      event.payload.selectedIndex >= event.payload.options.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['payload', 'selectedIndex'],
        message: 'Selected player-pick index must identify a visible option.',
      });
    }
  });

export const duplicateDetectedEventSchema = z.object({
  ...eventBase,
  type: z.literal('duplicate.detected'),
  payload: z.object({
    duplicate: visibleCardSchema,
    existingCard: visibleCardSchema.nullable(),
    source: z
      .object({
        context: screenKindSchema,
        visibleIndex: z.number().int().nonnegative(),
      })
      .optional(),
  }),
});

export const sbcContextVisibleEventSchema = z.object({
  ...eventBase,
  type: z.literal('sbcContext.visible'),
  payload: z.object({
    challengeName: stringObservationSchema,
    segmentName: stringObservationSchema,
    requirementLabels: z.array(stringObservationSchema),
    cards: z.array(visibleCardSchema),
  }),
});

export const marketContextVisibleEventSchema = z.object({
  ...eventBase,
  type: z.literal('marketContext.visible'),
  payload: z.object({
    selectedCard: visibleCardSchema.nullable(),
    displayedPrices: z.array(
      createObservationSchema(z.number().int().nonnegative()),
    ),
  }),
});

export const adapterDegradedEventSchema = z.object({
  ...eventBase,
  type: z.literal('adapter.degraded'),
  payload: z.object({
    screen: screenKindSchema,
    reasonCodes: z.array(z.string().min(1)).min(1),
  }),
});

const adapterRecoveredEventSchema = z.object({
  ...eventBase,
  type: z.literal('adapter.recovered'),
  payload: z.object({ screen: screenKindSchema }),
});

export const normalizedAdapterEventSchema = z.discriminatedUnion('type', [
  screenChangedEventSchema,
  cardSelectedEventSchema,
  cardsVisibleEventSchema,
  activeSquadVisibleEventSchema,
  packResultVisibleEventSchema,
  playerPickVisibleEventSchema,
  duplicateDetectedEventSchema,
  sbcContextVisibleEventSchema,
  marketContextVisibleEventSchema,
  adapterDegradedEventSchema,
  adapterRecoveredEventSchema,
]);

export type ScreenKind = z.infer<typeof screenKindSchema>;
export type VisibleCard = z.infer<typeof visibleCardSchema>;
export type NormalizedAdapterEvent = z.infer<
  typeof normalizedAdapterEventSchema
>;
