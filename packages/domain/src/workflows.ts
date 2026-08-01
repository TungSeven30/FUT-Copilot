import { z } from 'zod';

import {
  confidenceSchema,
  fcYearSchema,
  isoDateTimeSchema,
  localIdSchema,
  platformSchema,
} from './common';

export const recommendationReasonSchema = z.object({
  code: z.string().min(1),
  summary: z.string().min(1),
  detail: z.string().min(1),
  impact: z.number().min(-1).max(1),
  factStatus: z.enum(['known', 'inferred', 'unknown', 'stale']),
});

export const recommendationSchema = z.object({
  id: localIdSchema,
  subjectType: z.enum([
    'owned-card',
    'duplicate-case',
    'sbc-proposal',
    'market',
  ]),
  subjectId: localIdSchema,
  action: z.enum([
    'keep',
    'protect',
    'compare',
    'sell',
    'use-in-sbc',
    'quick-sell',
    'hold',
    'no-recommendation',
  ]),
  confidence: confidenceSchema,
  reasons: z.array(recommendationReasonSchema).min(1),
  generatedAt: isoDateTimeSchema,
});

export const duplicateResolutionSchema = z.object({
  action: z.enum([
    'kept-existing',
    'kept-duplicate',
    'listed',
    'used-in-sbc',
    'quick-sold',
    'deferred',
  ]),
  resolvedOwnedCardId: localIdSchema.optional(),
  userConfirmed: z.literal(true),
  resolvedAt: isoDateTimeSchema,
  notes: z.string().max(2_000),
});

export const duplicateCaseSchema = z.object({
  id: localIdSchema,
  profileId: localIdSchema,
  cardDefinitionId: localIdSchema,
  existingOwnedCardId: localIdSchema.optional(),
  duplicateOwnedCardId: localIdSchema.optional(),
  tradeability: z.enum(['tradeable', 'untradeable', 'unknown']),
  state: z.enum(['open', 'resolved', 'dismissed']),
  detectedAt: isoDateTimeSchema,
  resolution: duplicateResolutionSchema.optional(),
});

export const sbcRequirementSchema = z.object({
  id: localIdSchema,
  label: z.string().min(1),
  kind: z.enum([
    'minimum-rating',
    'minimum-chemistry',
    'minimum-count',
    'maximum-count',
    'required-club',
    'required-league',
    'required-nation',
    'required-rarity',
    'other',
  ]),
  threshold: z.number().optional(),
  qualifier: z.string().min(1).optional(),
  status: z.enum(['known', 'inferred', 'unknown', 'stale']),
});

export const sbcDefinitionSchema = z.object({
  id: localIdSchema,
  fcYear: fcYearSchema,
  name: z.string().min(1),
  segmentName: z.string().min(1),
  requirements: z.array(sbcRequirementSchema),
  repeatable: z.boolean().optional(),
  observedAt: isoDateTimeSchema,
});

export const sbcProposalSchema = z.object({
  id: localIdSchema,
  profileId: localIdSchema,
  sbcDefinitionId: localIdSchema,
  candidateOwnedCardIds: z.array(localIdSchema).max(23),
  excludedProtectedCardIds: z.array(localIdSchema),
  estimatedRating: z.number().min(0).max(99).optional(),
  estimatedChemistry: z.number().min(0).optional(),
  warnings: z.array(z.string().min(1)),
  state: z.enum(['draft', 'accepted-by-user', 'rejected-by-user']),
  createdAt: isoDateTimeSchema,
});

export const marketObservationSchema = z.object({
  id: localIdSchema,
  profileId: localIdSchema,
  cardDefinitionId: localIdSchema,
  platform: platformSchema,
  amount: z.number().int().positive(),
  priceKind: z.enum([
    'buy-now',
    'bid',
    'listing',
    'sale',
    'range-min',
    'range-max',
  ]),
  source: z.enum(['user', 'ea-visible-ui', 'authorized-public-data']),
  observedAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema.optional(),
  notes: z.string().max(2_000),
});

export const marketTransactionSchema = z.object({
  id: localIdSchema,
  profileId: localIdSchema,
  cardDefinitionId: localIdSchema,
  ownedCardId: localIdSchema.optional(),
  platform: platformSchema,
  transactionType: z.enum(['purchase', 'sale', 'listing', 'expired-listing']),
  amount: z.number().int().nonnegative(),
  eaTax: z.number().int().nonnegative().optional(),
  occurredAt: isoDateTimeSchema,
  userConfirmed: z.literal(true),
  notes: z.string().max(2_000),
});

export const adapterHealthSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unsupported']),
  adapterVersion: z.string().min(1),
  screen: z.string().min(1),
  reasonCodes: z.array(z.string().min(1)),
  checkedAt: isoDateTimeSchema,
});

export const compatibilityRecordSchema = z.object({
  id: localIdSchema,
  adapterVersion: z.string().min(1),
  fcYear: fcYearSchema,
  webAppBuild: z.string().min(1).nullable(),
  routeFamily: z.string().min(1),
  locale: z.string().min(2),
  fixtureId: z.string().min(1),
  result: z.enum(['pass', 'degraded', 'fail']),
  observedFields: z.array(z.string().min(1)),
  ambiguityNotes: z.array(z.string().min(1)),
  testedAt: isoDateTimeSchema,
});

export type Recommendation = z.infer<typeof recommendationSchema>;
export type DuplicateCase = z.infer<typeof duplicateCaseSchema>;
export type SbcDefinition = z.infer<typeof sbcDefinitionSchema>;
export type SbcProposal = z.infer<typeof sbcProposalSchema>;
export type MarketObservation = z.infer<typeof marketObservationSchema>;
export type MarketTransaction = z.infer<typeof marketTransactionSchema>;
export type CompatibilityRecord = z.infer<typeof compatibilityRecordSchema>;
