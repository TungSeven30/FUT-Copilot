import {
  normalizedAdapterEventSchema,
  type VisibleCard,
} from '@fut-copilot/domain/adapter-events';
import type { CardDefinition, OwnedCard } from '@fut-copilot/domain/cards';
import { resolveCardIdentity } from '@fut-copilot/domain/identity';
import {
  personalProfileSchema,
  type PersonalProfile,
  type PersonalTag,
} from '@fut-copilot/domain/profile';
import {
  duplicateCaseSchema,
  sbcDefinitionSchema,
  sbcProposalSchema,
  type DuplicateCase,
  type SbcDefinition,
  type SbcProposal,
} from '@fut-copilot/domain/workflows';

import {
  tableNames,
  type DatabaseTableName,
  type FutCopilotDatabase,
} from './database';
import { visibleCardIdentityFacts } from './personalization';

export type DuplicateQueueRow = {
  duplicateCase: DuplicateCase;
  cardName: string;
  protected: boolean;
  protectingTagNames: string[];
};

export type SbcInventoryCard = {
  ownedCard: OwnedCard;
  definition: CardDefinition;
  tags: PersonalTag[];
  duplicate: boolean;
};

export type AdapterDiagnostics = {
  lastSuccessfulAt: string | null;
  lastSuccessfulEventType: string | null;
  lastKnownWebAppBuild: string | null;
};

export type VisibleCardProtectionResult = {
  localObservationId: string;
  cardName: string;
  status: 'protected' | 'clear' | 'unresolved';
  protectingTagNames: string[];
  reason: string;
};

export async function getDuplicateQueueRows(
  database: FutCopilotDatabase,
): Promise<DuplicateQueueRow[]> {
  const [cases, definitions, ownedCards, tags] = await Promise.all([
    database.duplicateCases.toArray(),
    database.cardDefinitions.toArray(),
    database.ownedCards.toArray(),
    database.personalTags.toArray(),
  ]);
  const names = new Map(
    definitions.map((definition) => [
      definition.id,
      definition.name.value ?? 'Unknown card',
    ]),
  );
  const ownedById = new Map(
    ownedCards.map((ownedCard) => [ownedCard.id, ownedCard]),
  );
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));

  return cases
    .map((duplicateCase) => duplicateCaseSchema.parse(duplicateCase))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((duplicateCase) => {
      const caseOwnedCards = [
        duplicateCase.existingOwnedCardId,
        duplicateCase.duplicateOwnedCardId,
      ].flatMap((ownedCardId) => {
        if (ownedCardId === undefined) return [];
        const ownedCard = ownedById.get(ownedCardId);
        return ownedCard === undefined ? [] : [ownedCard];
      });
      const protectingTagNames = [
        ...new Set(
          caseOwnedCards.flatMap((ownedCard) =>
            ownedCard.personalTagIds.flatMap((tagId) => {
              const tag = tagsById.get(tagId);
              return tag?.protectsCard === true ? [tag.name] : [];
            }),
          ),
        ),
      ];
      return {
        duplicateCase,
        cardName: names.get(duplicateCase.cardDefinitionId) ?? 'Unknown card',
        protected:
          caseOwnedCards.some((ownedCard) => ownedCard.protected) ||
          protectingTagNames.length > 0,
        protectingTagNames,
      };
    });
}

export async function getSbcInventory(
  database: FutCopilotDatabase,
): Promise<SbcInventoryCard[]> {
  const [ownedCards, definitions, tags, duplicateCases] = await Promise.all([
    database.ownedCards.toArray(),
    database.cardDefinitions.toArray(),
    database.personalTags.toArray(),
    database.duplicateCases.toArray(),
  ]);
  const definitionsById = new Map(
    definitions.map((definition) => [definition.id, definition]),
  );
  const duplicateOwnedIds = new Set(
    duplicateCases.flatMap((duplicateCase) =>
      duplicateCase.state === 'resolved' ||
      duplicateCase.duplicateOwnedCardId === undefined
        ? []
        : [duplicateCase.duplicateOwnedCardId],
    ),
  );

  return ownedCards.flatMap((ownedCard) => {
    const definition = definitionsById.get(ownedCard.cardDefinitionId);
    return definition === undefined || ownedCard.ownershipStatus !== 'owned'
      ? []
      : [
          {
            ownedCard,
            definition,
            tags,
            duplicate: duplicateOwnedIds.has(ownedCard.id),
          },
        ];
  });
}

export async function scanVisibleCardProtection(
  database: FutCopilotDatabase,
  cards: VisibleCard[],
): Promise<VisibleCardProtectionResult[]> {
  const [definitions, ownedCards, tags] = await Promise.all([
    database.cardDefinitions.toArray(),
    database.ownedCards.toArray(),
    database.personalTags.toArray(),
  ]);
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));

  return cards.map((card) => {
    const cardName = card.name.value ?? 'Unknown visible card';
    const resolution = resolveCardIdentity(
      visibleCardIdentityFacts(card),
      definitions,
    );
    if (resolution.status !== 'resolved') {
      return {
        localObservationId: card.localObservationId,
        cardName,
        status: 'unresolved',
        protectingTagNames: [],
        reason:
          resolution.status === 'ambiguous'
            ? 'Multiple local identities match this visible SBC card.'
            : 'No confirmed local identity matches this visible SBC card.',
      };
    }

    const matchingOwnedCards = ownedCards.filter(
      (ownedCard) =>
        ownedCard.cardDefinitionId === resolution.candidate.cardDefinition.id &&
        ownedCard.ownershipStatus === 'owned',
    );
    if (matchingOwnedCards.length === 0) {
      return {
        localObservationId: card.localObservationId,
        cardName,
        status: 'unresolved',
        protectingTagNames: [],
        reason: 'The card definition matched, but no owned copy was confirmed.',
      };
    }

    const protectingTagNames = [
      ...new Set(
        matchingOwnedCards.flatMap((ownedCard) =>
          ownedCard.personalTagIds.flatMap((tagId) => {
            const tag = tagsById.get(tagId);
            return tag?.protectsCard === true ? [tag.name] : [];
          }),
        ),
      ),
    ];
    const protectedCard =
      matchingOwnedCards.some((ownedCard) => ownedCard.protected) ||
      protectingTagNames.length > 0;
    return {
      localObservationId: card.localObservationId,
      cardName,
      status: protectedCard ? 'protected' : 'clear',
      protectingTagNames,
      reason: protectedCard
        ? 'At least one matching owned copy is protected by local rules.'
        : 'Matching owned copies are not protected by current local rules.',
    };
  });
}

export async function saveSbcProposal(
  database: FutCopilotDatabase,
  definitionInput: SbcDefinition,
  proposalInput: SbcProposal,
): Promise<SbcProposal> {
  const definition = sbcDefinitionSchema.parse(definitionInput);
  const proposal = sbcProposalSchema.parse(proposalInput);
  if (proposal.sbcDefinitionId !== definition.id) {
    throw new Error('SBC proposal does not reference its definition.');
  }

  await database.transaction(
    'rw',
    database.sbcDefinitions,
    database.sbcProposals,
    async () => {
      await database.sbcDefinitions.add(definition);
      await database.sbcProposals.add(proposal);
    },
  );
  return proposal;
}

export async function getTableCounts(
  database: FutCopilotDatabase,
): Promise<Record<DatabaseTableName, number>> {
  return Object.fromEntries(
    await Promise.all(
      tableNames.map(async (tableName) => [
        tableName,
        await database.table(tableName).count(),
      ]),
    ),
  ) as Record<DatabaseTableName, number>;
}

export async function getAdapterDiagnostics(
  database: FutCopilotDatabase,
): Promise<AdapterDiagnostics> {
  const observations = (await database.observations.toArray())
    .map((event) => normalizedAdapterEventSchema.parse(event))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  const successful = observations.find(
    (event) =>
      event.type !== 'adapter.degraded' &&
      event.type !== 'adapter.recovered' &&
      event.type !== 'screen.changed',
  );
  const lastKnownBuild = observations.find(
    (event) => event.webAppBuild.value !== null,
  );

  return {
    lastSuccessfulAt: successful?.occurredAt ?? null,
    lastSuccessfulEventType: successful?.type ?? null,
    lastKnownWebAppBuild: lastKnownBuild?.webAppBuild.value ?? null,
  };
}

export async function savePersonalProfile(
  database: FutCopilotDatabase,
  profileInput: PersonalProfile,
): Promise<PersonalProfile> {
  const profile = personalProfileSchema.parse(profileInput);
  await database.profiles.put(profile);
  return profile;
}
