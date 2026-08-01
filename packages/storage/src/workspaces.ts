import type { CardDefinition, OwnedCard } from '@fut-copilot/domain/cards';
import { normalizedAdapterEventSchema } from '@fut-copilot/domain/adapter-events';
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

export type DuplicateQueueRow = {
  duplicateCase: DuplicateCase;
  cardName: string;
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

export async function getDuplicateQueueRows(
  database: FutCopilotDatabase,
): Promise<DuplicateQueueRow[]> {
  const [cases, definitions] = await Promise.all([
    database.duplicateCases.toArray(),
    database.cardDefinitions.toArray(),
  ]);
  const names = new Map(
    definitions.map((definition) => [
      definition.id,
      definition.name.value ?? 'Unknown card',
    ]),
  );

  return cases
    .map((duplicateCase) => duplicateCaseSchema.parse(duplicateCase))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((duplicateCase) => ({
      duplicateCase,
      cardName: names.get(duplicateCase.cardDefinitionId) ?? 'Unknown card',
    }));
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
