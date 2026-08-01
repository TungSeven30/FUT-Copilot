import { z } from 'zod';

import { isoDateTimeSchema, localIdSchema, platformSchema } from './common';

export const recommendationWeightsSchema = z.object({
  metaPerformance: z.number().min(0).max(1),
  favoritePlayer: z.number().min(0).max(1),
  favoriteClub: z.number().min(0).max(1),
  evolutionPotential: z.number().min(0).max(1),
  marketValue: z.number().min(0).max(1),
  sbcUtility: z.number().min(0).max(1),
});

export const personalProfileSchema = z.object({
  id: localIdSchema,
  displayName: z.string().min(1).max(80),
  platform: platformSchema,
  favoritePlayerNames: z.array(z.string().min(1)).max(100),
  favoriteClubNames: z.array(z.string().min(1)).max(50),
  recommendationWeights: recommendationWeightsSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const personalTagSchema = z.object({
  id: localIdSchema,
  profileId: localIdSchema,
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  protectsCard: z.boolean(),
  createdAt: isoDateTimeSchema,
});

export const protectionRuleSchema = z.object({
  id: localIdSchema,
  profileId: localIdSchema,
  name: z.string().min(1).max(100),
  enabled: z.boolean(),
  priority: z.number().int().min(0).max(1_000),
  match: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('tag'), tagId: localIdSchema }),
    z.object({
      kind: z.literal('minimum-rating'),
      rating: z.int().min(1).max(99),
    }),
    z.object({ kind: z.literal('favorite-player') }),
    z.object({ kind: z.literal('favorite-club') }),
    z.object({ kind: z.literal('active-squad') }),
    z.object({ kind: z.literal('evolution-project') }),
  ]),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type RecommendationWeights = z.infer<typeof recommendationWeightsSchema>;
export type PersonalProfile = z.infer<typeof personalProfileSchema>;
export type PersonalTag = z.infer<typeof personalTagSchema>;
export type ProtectionRule = z.infer<typeof protectionRuleSchema>;
