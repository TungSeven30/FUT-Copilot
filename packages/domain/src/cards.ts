import { z } from 'zod';

import {
  confidenceSchema,
  fcYearSchema,
  isoDateTimeSchema,
  localIdSchema,
  platformSchema,
} from './common';
import {
  booleanObservationSchema,
  createObservationSchema,
  integerObservationSchema,
  stringObservationSchema,
} from './observation';

export const cardDefinitionSchema = z.object({
  id: localIdSchema,
  fcYear: fcYearSchema,
  assetId: stringObservationSchema,
  resourceId: stringObservationSchema,
  name: stringObservationSchema,
  overall: createObservationSchema(z.number().int().min(1).max(99)),
  position: stringObservationSchema,
  club: stringObservationSchema,
  league: stringObservationSchema,
  nation: stringObservationSchema,
  rarity: stringObservationSchema,
  promotion: stringObservationSchema,
  imageReference: stringObservationSchema.optional(),
  identityConfidence: confidenceSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const tradeabilitySchema = z.enum([
  'tradeable',
  'untradeable',
  'unknown',
]);

export const ownershipStatusSchema = z.enum([
  'owned',
  'sold',
  'submitted',
  'discarded',
  'unknown',
]);

export const cardLocationSchema = z.enum([
  'active-squad',
  'bench',
  'reserves',
  'club',
  'sbc-storage',
  'duplicate-queue',
  'transfer-list',
  'unassigned',
  'unknown',
]);

export const ownedCardSchema = z.object({
  id: localIdSchema,
  cardDefinitionId: localIdSchema,
  profileId: localIdSchema,
  ownershipStatus: ownershipStatusSchema,
  tradeability: tradeabilitySchema,
  firstOwner: booleanObservationSchema,
  location: cardLocationSchema,
  purchasePrice: integerObservationSchema.optional(),
  platform: platformSchema,
  protected: z.boolean(),
  personalTagIds: z.array(localIdSchema),
  notes: z.string().max(4_000),
  firstObservedAt: isoDateTimeSchema,
  lastObservedAt: isoDateTimeSchema,
});

export const cardIdentityCandidateSchema = z.object({
  id: localIdSchema,
  observedName: z.string().min(1),
  candidateCardDefinitionId: localIdSchema,
  confidence: confidenceSchema,
  matchingFacts: z.array(z.string().min(1)).min(1),
  conflictingFacts: z.array(z.string().min(1)),
  createdAt: isoDateTimeSchema,
});

export type CardDefinition = z.infer<typeof cardDefinitionSchema>;
export type Tradeability = z.infer<typeof tradeabilitySchema>;
export type OwnedCard = z.infer<typeof ownedCardSchema>;
export type CardIdentityCandidate = z.infer<typeof cardIdentityCandidateSchema>;
