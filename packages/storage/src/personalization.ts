import type { VisibleCard } from '@fut-copilot/domain/adapter-events';
import {
  cardDefinitionSchema,
  ownedCardSchema,
  type CardDefinition,
  type OwnedCard,
} from '@fut-copilot/domain/cards';
import {
  resolveCardIdentity,
  type CardIdentityFacts,
  type IdentityCandidate,
} from '@fut-copilot/domain/identity';
import {
  personalProfileSchema,
  personalTagSchema,
  protectionRuleSchema,
  type PersonalProfile,
  type PersonalTag,
} from '@fut-copilot/domain/profile';
import {
  marketObservationSchema,
  type MarketObservation,
} from '@fut-copilot/domain/workflows';
import type { Platform } from '@fut-copilot/domain/common';

import type { FutCopilotDatabase } from './database';

export const DEFAULT_PROFILE_ID = '184efabf-5e2c-4afd-bd70-51f450602085';

const defaultTagInputs = [
  {
    id: 'f40c4313-7f7f-40eb-9561-9709dbdb7887',
    name: 'protected',
    color: '#ff6b6b',
    protectsCard: true,
  },
  {
    id: '2fe3397a-6421-4903-bd28-286dd3e27129',
    name: 'favorite',
    color: '#ffd166',
    protectsCard: true,
  },
  {
    id: 'ef05a1a6-0631-4f3f-806a-73a4081490bc',
    name: 'Evo project',
    color: '#c77dff',
    protectsCard: true,
  },
  {
    id: 'e4ab2d73-502c-49e0-8772-1947136322b6',
    name: 'active squad',
    color: '#4cc9f0',
    protectsCard: true,
  },
  {
    id: '6659400b-949b-4d7d-a7dc-a9b4f7450a5e',
    name: 'fodder',
    color: '#95a5a6',
    protectsCard: false,
  },
  {
    id: '4850236d-cea9-4a5f-af14-9d8a67a830c1',
    name: 'investment',
    color: '#2ec4b6',
    protectsCard: false,
  },
  {
    id: '67a3f46a-649d-482f-836d-c2b8062a96f3',
    name: 'review needed',
    color: '#ff9f1c',
    protectsCard: false,
  },
] as const;

export type PersonalizedCardContext = {
  profile: PersonalProfile;
  tags: PersonalTag[];
  identity:
    | {
        status: 'created' | 'resolved';
        confidence: number;
        strategy: 'new-local-definition' | IdentityCandidate['strategy'];
      }
    | {
        status: 'ambiguous';
        candidates: IdentityCandidate[];
      };
  cardDefinition: CardDefinition | null;
  ownedCard: OwnedCard | null;
};

function nowIso(now?: () => Date): string {
  return (now ?? (() => new Date()))().toISOString();
}

function unknownString(observedAt: string) {
  return {
    value: null,
    source: 'ea-visible-ui' as const,
    observedAt,
    status: 'unknown' as const,
  };
}

export function createDefaultProfile(createdAt: string): PersonalProfile {
  return personalProfileSchema.parse({
    id: DEFAULT_PROFILE_ID,
    displayName: 'My FUT workspace',
    platform: 'playstation',
    favoritePlayerNames: [],
    favoriteClubNames: [],
    recommendationWeights: {
      metaPerformance: 0.8,
      favoritePlayer: 1,
      favoriteClub: 0.8,
      evolutionPotential: 0.9,
      marketValue: 0.6,
      sbcUtility: 0.7,
    },
    createdAt,
    updatedAt: createdAt,
  });
}

export async function ensureDefaultProfile(
  database: FutCopilotDatabase,
  now?: () => Date,
): Promise<{ profile: PersonalProfile; tags: PersonalTag[] }> {
  const createdAt = nowIso(now);

  await database.transaction(
    'rw',
    database.profiles,
    database.personalTags,
    database.protectionRules,
    async () => {
      if ((await database.profiles.get(DEFAULT_PROFILE_ID)) === undefined) {
        await database.profiles.add(createDefaultProfile(createdAt));
      }

      for (const tagInput of defaultTagInputs) {
        const tag = personalTagSchema.parse({
          ...tagInput,
          profileId: DEFAULT_PROFILE_ID,
          createdAt,
        });
        if ((await database.personalTags.get(tag.id)) === undefined) {
          await database.personalTags.add(tag);
        }

        if (tag.protectsCard) {
          const ruleId = tag.id.replace(/^./, 'a');
          if ((await database.protectionRules.get(ruleId)) === undefined) {
            await database.protectionRules.add(
              protectionRuleSchema.parse({
                id: ruleId,
                profileId: DEFAULT_PROFILE_ID,
                name: `Protect cards tagged ${tag.name}`,
                enabled: true,
                priority: 900,
                match: { kind: 'tag', tagId: tag.id },
                createdAt,
                updatedAt: createdAt,
              }),
            );
          }
        }
      }
    },
  );

  const profile = await database.profiles.get(DEFAULT_PROFILE_ID);
  if (profile === undefined) {
    throw new Error('Default profile initialization failed.');
  }

  return {
    profile: personalProfileSchema.parse(profile),
    tags: (
      await database.personalTags
        .where('profileId')
        .equals(DEFAULT_PROFILE_ID)
        .toArray()
    ).map((tag) => personalTagSchema.parse(tag)),
  };
}

export function visibleCardIdentityFacts(card: VisibleCard): CardIdentityFacts {
  return {
    assetId: unknownString(card.name.observedAt),
    resourceId: unknownString(card.name.observedAt),
    name: card.name,
    overall: card.overall,
    position: card.position,
    club: card.club,
    league: card.league,
    nation: card.nation,
    rarity: card.rarity,
  };
}

function createDefinition(
  card: VisibleCard,
  createdAt: string,
  createId: () => string,
): CardDefinition {
  return cardDefinitionSchema.parse({
    id: createId(),
    fcYear: 26,
    assetId: unknownString(createdAt),
    resourceId: unknownString(createdAt),
    name: card.name,
    overall: card.overall,
    position: card.position,
    club: card.club,
    league: card.league,
    nation: card.nation,
    rarity: card.rarity,
    promotion: unknownString(createdAt),
    identityConfidence: 0.765,
    createdAt,
    updatedAt: createdAt,
  });
}

function observedTradeability(card: VisibleCard): OwnedCard['tradeability'] {
  return card.tradeability.value ?? 'unknown';
}

async function ensureOwnedCard(
  database: FutCopilotDatabase,
  definition: CardDefinition,
  card: VisibleCard,
  profile: PersonalProfile,
  observedAt: string,
  createId: () => string,
): Promise<OwnedCard> {
  const existing = await database.ownedCards
    .where('[profileId+cardDefinitionId]')
    .equals([profile.id, definition.id])
    .first();

  if (existing !== undefined) {
    const updated = ownedCardSchema.parse({
      ...existing,
      tradeability:
        observedTradeability(card) === 'unknown'
          ? existing.tradeability
          : observedTradeability(card),
      firstOwner:
        card.firstOwner.value === null ? existing.firstOwner : card.firstOwner,
      lastObservedAt: observedAt,
    });
    await database.ownedCards.put(updated);
    return updated;
  }

  const ownedCard = ownedCardSchema.parse({
    id: createId(),
    cardDefinitionId: definition.id,
    profileId: profile.id,
    ownershipStatus: 'owned',
    tradeability: observedTradeability(card),
    firstOwner: card.firstOwner,
    location: 'club',
    platform: profile.platform,
    protected: false,
    personalTagIds: [],
    notes: '',
    firstObservedAt: observedAt,
    lastObservedAt: observedAt,
  });
  await database.ownedCards.add(ownedCard);
  return ownedCard;
}

export async function ensureSelectedCardContext(
  database: FutCopilotDatabase,
  card: VisibleCard,
  options: { createId?: () => string; now?: () => Date } = {},
): Promise<PersonalizedCardContext> {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const observedAt = nowIso(options.now);
  const { profile, tags } = await ensureDefaultProfile(database, options.now);
  const definitions = await database.cardDefinitions.toArray();
  const resolution = resolveCardIdentity(
    visibleCardIdentityFacts(card),
    definitions,
  );

  if (resolution.status === 'ambiguous') {
    return {
      profile,
      tags,
      identity: { status: 'ambiguous', candidates: resolution.candidates },
      cardDefinition: null,
      ownedCard: null,
    };
  }

  let definition: CardDefinition;
  let identity: PersonalizedCardContext['identity'];
  if (resolution.status === 'unmatched') {
    definition = createDefinition(card, observedAt, createId);
    await database.cardDefinitions.add(definition);
    identity = {
      status: 'created',
      confidence: definition.identityConfidence,
      strategy: 'new-local-definition',
    };
  } else {
    definition = resolution.candidate.cardDefinition;
    identity = {
      status: 'resolved',
      confidence: resolution.candidate.confidence,
      strategy: resolution.candidate.strategy,
    };
  }

  const ownedCard = await ensureOwnedCard(
    database,
    definition,
    card,
    profile,
    observedAt,
    createId,
  );
  return { profile, tags, identity, cardDefinition: definition, ownedCard };
}

export async function updateOwnedCardPersonalization(
  database: FutCopilotDatabase,
  input: { ownedCardId: string; personalTagIds: string[]; notes: string },
): Promise<OwnedCard> {
  const existing = await database.ownedCards.get(input.ownedCardId);
  if (existing === undefined) {
    throw new Error('Owned card not found.');
  }

  const selectedTags = await database.personalTags.bulkGet(
    input.personalTagIds,
  );
  const protectedByTag = selectedTags.some((tag) => tag?.protectsCard === true);
  const updated = ownedCardSchema.parse({
    ...existing,
    personalTagIds: [...new Set(input.personalTagIds)],
    notes: input.notes,
    protected: protectedByTag,
  });
  await database.ownedCards.put(updated);
  return updated;
}

export async function recordManualMarketObservation(
  database: FutCopilotDatabase,
  input: {
    profileId: string;
    cardDefinitionId: string;
    amount: number;
    platform?: Platform;
    notes?: string;
    now?: () => Date;
    createId?: () => string;
  },
): Promise<MarketObservation> {
  const observation = marketObservationSchema.parse({
    id: (input.createId ?? (() => crypto.randomUUID()))(),
    profileId: input.profileId,
    cardDefinitionId: input.cardDefinitionId,
    platform: input.platform ?? 'playstation',
    amount: input.amount,
    priceKind: 'buy-now',
    source: 'user',
    observedAt: nowIso(input.now),
    notes: input.notes ?? '',
  });
  await database.marketObservations.add(observation);
  return observation;
}

export async function getLatestMarketObservation(
  database: FutCopilotDatabase,
  cardDefinitionId: string,
): Promise<MarketObservation | null> {
  const observations = await database.marketObservations
    .where('cardDefinitionId')
    .equals(cardDefinitionId)
    .toArray();
  const latest = observations.sort((left, right) =>
    right.observedAt.localeCompare(left.observedAt),
  )[0];
  return latest === undefined ? null : marketObservationSchema.parse(latest);
}

export async function updateOwnedCardPurchasePrice(
  database: FutCopilotDatabase,
  input: { ownedCardId: string; amount: number | null; now?: () => Date },
): Promise<OwnedCard> {
  const existing = await database.ownedCards.get(input.ownedCardId);
  if (existing === undefined) {
    throw new Error('Owned card not found.');
  }
  const observedAt = nowIso(input.now);
  const updated = ownedCardSchema.parse({
    ...existing,
    purchasePrice:
      input.amount === null
        ? undefined
        : {
            value: input.amount,
            source: 'user',
            observedAt,
            status: 'known',
            evidence: ['manual-purchase-price'],
          },
  });
  await database.ownedCards.put(updated);
  return updated;
}
