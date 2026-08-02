import {
  duplicateDetectedEventSchema,
  type NormalizedAdapterEvent,
} from '@fut-copilot/domain/adapter-events';
import { ownedCardSchema } from '@fut-copilot/domain/cards';
import {
  duplicateCaseSchema,
  duplicateResolutionSchema,
  type DuplicateCase,
} from '@fut-copilot/domain/workflows';

import type { FutCopilotDatabase } from './database';
import { persistNormalizedAdapterEvent } from './observations';
import { ensureSelectedCardContext } from './personalization';

type DuplicateDetectedEvent = Extract<
  NormalizedAdapterEvent,
  { type: 'duplicate.detected' }
>;
type PackResultVisibleEvent = Extract<
  NormalizedAdapterEvent,
  { type: 'packResult.visible' }
>;

export type DuplicateCaseCreation =
  | { status: 'created' | 'existing'; duplicateCase: DuplicateCase }
  | { status: 'ambiguous' };

export async function createDuplicateCasesFromPackResultEvent(
  database: FutCopilotDatabase,
  event: PackResultVisibleEvent,
  options: { createId?: () => string; now?: () => Date } = {},
): Promise<DuplicateCaseCreation[]> {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const results: DuplicateCaseCreation[] = [];
  for (const visibleIndex of event.payload.duplicateIndexes) {
    const duplicate = event.payload.cards[visibleIndex];
    if (duplicate === undefined) {
      throw new Error('Validated pack duplicate index became unavailable.');
    }
    const derived = duplicateDetectedEventSchema.parse({
      eventVersion: 1,
      eventId: createId(),
      type: 'duplicate.detected',
      webAppBuild: event.webAppBuild,
      occurredAt: event.occurredAt,
      confidence: event.confidence,
      extractionStatus: event.extractionStatus,
      adapterVersion: event.adapterVersion,
      payload: {
        duplicate,
        existingCard: null,
        source: { context: 'pack-result', visibleIndex },
      },
    });
    const persisted = await persistNormalizedAdapterEvent(database, derived);
    if (persisted.event.type !== 'duplicate.detected') {
      throw new Error('Persisted pack duplicate changed event type.');
    }
    results.push(
      await createDuplicateCaseFromEvent(database, persisted.event, options),
    );
  }
  return results;
}

export async function createDuplicateCaseFromEvent(
  database: FutCopilotDatabase,
  event: DuplicateDetectedEvent,
  options: { createId?: () => string; now?: () => Date } = {},
): Promise<DuplicateCaseCreation> {
  const alreadyCreated = await database.duplicateCases
    .filter((duplicateCase) => duplicateCase.sourceEventId === event.eventId)
    .first();
  if (alreadyCreated !== undefined) {
    return {
      status: 'existing',
      duplicateCase: duplicateCaseSchema.parse(alreadyCreated),
    };
  }

  const context = await ensureSelectedCardContext(
    database,
    event.payload.duplicate,
    options,
  );
  if (context.cardDefinition === null || context.ownedCard === null) {
    return { status: 'ambiguous' };
  }

  const createId = options.createId ?? (() => crypto.randomUUID());
  const timestamp = (options.now ?? (() => new Date()))().toISOString();
  const duplicateOwnedCard = ownedCardSchema.parse({
    ...context.ownedCard,
    id: createId(),
    location: 'duplicate-queue',
    firstObservedAt: timestamp,
    lastObservedAt: timestamp,
  });
  const duplicateCase = duplicateCaseSchema.parse({
    id: createId(),
    profileId: context.profile.id,
    cardDefinitionId: context.cardDefinition.id,
    sourceEventId: event.eventId,
    existingOwnedCardId: context.ownedCard.id,
    duplicateOwnedCardId: duplicateOwnedCard.id,
    tradeability: duplicateOwnedCard.tradeability,
    state: 'detected',
    detectedAt: timestamp,
    updatedAt: timestamp,
  });

  await database.transaction(
    'rw',
    database.ownedCards,
    database.duplicateCases,
    async () => {
      await database.ownedCards.add(duplicateOwnedCard);
      await database.duplicateCases.add(duplicateCase);
    },
  );
  return { status: 'created', duplicateCase };
}

export async function updateDuplicateCaseState(
  database: FutCopilotDatabase,
  input: {
    duplicateCaseId: string;
    state: 'investigating' | 'destination-selected' | 'dismissed';
    now?: () => Date;
  },
): Promise<DuplicateCase> {
  const existing = await database.duplicateCases.get(input.duplicateCaseId);
  if (existing === undefined) {
    throw new Error('Duplicate case not found.');
  }
  if (existing.state === 'resolved') {
    throw new Error('Resolved duplicate cases cannot be reopened implicitly.');
  }

  const updated = duplicateCaseSchema.parse({
    ...existing,
    state: input.state,
    updatedAt: (input.now ?? (() => new Date()))().toISOString(),
  });
  await database.duplicateCases.put(updated);
  return updated;
}

export async function resolveDuplicateCase(
  database: FutCopilotDatabase,
  input: {
    duplicateCaseId: string;
    action:
      | 'kept-existing'
      | 'kept-duplicate'
      | 'listed'
      | 'used-in-sbc'
      | 'quick-sold'
      | 'deferred';
    resolvedOwnedCardId?: string;
    notes?: string;
    now?: () => Date;
  },
): Promise<DuplicateCase> {
  const existing = await database.duplicateCases.get(input.duplicateCaseId);
  if (existing === undefined) {
    throw new Error('Duplicate case not found.');
  }
  const resolvedAt = (input.now ?? (() => new Date()))().toISOString();
  const resolution = duplicateResolutionSchema.parse({
    action: input.action,
    ...(input.resolvedOwnedCardId === undefined
      ? {}
      : { resolvedOwnedCardId: input.resolvedOwnedCardId }),
    userConfirmed: true,
    resolvedAt,
    notes: input.notes ?? '',
  });
  const updated = duplicateCaseSchema.parse({
    ...existing,
    state: 'resolved',
    resolution,
    updatedAt: resolvedAt,
  });
  await database.duplicateCases.put(updated);
  return updated;
}
