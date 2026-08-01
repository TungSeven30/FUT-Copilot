import type {
  NormalizedAdapterEvent,
  VisibleCard,
} from '@fut-copilot/domain/adapter-events';
import type { Observation } from '@fut-copilot/domain/observation';

import { FutCopilotDatabase } from './database';
import {
  ensureSelectedCardContext,
  updateOwnedCardPersonalization,
} from './personalization';
import {
  getDuplicateQueueRows,
  getAdapterDiagnostics,
  getSbcInventory,
  getTableCounts,
  scanVisibleCardProtection,
  savePersonalProfile,
} from './workspaces';

const databases: FutCopilotDatabase[] = [];
const observedAt = '2026-08-01T15:00:00.000Z';

function known<T>(value: T): Observation<T> {
  return { value, source: 'fixture', observedAt, status: 'known' };
}

function unknown<T>(): Observation<T> {
  return { value: null, source: 'fixture', observedAt, status: 'unknown' };
}

function visibleCard(): VisibleCard {
  return {
    localObservationId: 'bf96db90-a646-488a-be94-29c0307256d7',
    name: known('Workspace Example'),
    overall: known(86),
    position: known('CM'),
    club: unknown(),
    league: unknown(),
    nation: unknown(),
    rarity: known('rare'),
    tradeability: known('untradeable'),
    firstOwner: unknown(),
    loan: known(false),
    faceStats: [],
  };
}

function createDatabase(): FutCopilotDatabase {
  const database = new FutCopilotDatabase(
    `fut-copilot-workspaces-${crypto.randomUUID()}`,
  );
  databases.push(database);
  return database;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe('workspace storage services', () => {
  it('returns normalized SBC inventory and table counts', async () => {
    const database = createDatabase();
    const context = await ensureSelectedCardContext(database, visibleCard(), {
      now: () => new Date(observedAt),
    });

    const inventory = await getSbcInventory(database);
    const counts = await getTableCounts(database);

    expect(inventory).toHaveLength(1);
    expect(inventory[0]?.definition.name.value).toBe('Workspace Example');
    expect(inventory[0]?.duplicate).toBe(false);
    expect(counts.cardDefinitions).toBe(1);
    expect(counts.ownedCards).toBe(1);

    await savePersonalProfile(database, {
      ...context.profile,
      displayName: 'Updated local workspace',
      updatedAt: '2026-08-01T16:00:00.000Z',
    });
    expect((await database.profiles.get(context.profile.id))?.displayName).toBe(
      'Updated local workspace',
    );
  });

  it('reports the latest successful adapter observation and known build', async () => {
    const database = createDatabase();
    const event: NormalizedAdapterEvent = {
      eventVersion: 1,
      eventId: '668faf7c-da14-4f9b-9858-98dd39bc5647',
      type: 'card.selected',
      webAppBuild: known('synthetic-build'),
      occurredAt: observedAt,
      confidence: 1,
      extractionStatus: 'known',
      adapterVersion: 'test-adapter',
      payload: { screen: 'club', card: visibleCard() },
    };
    await database.observations.add(event);

    expect(await getAdapterDiagnostics(database)).toEqual({
      lastSuccessfulAt: observedAt,
      lastSuccessfulEventType: 'card.selected',
      lastKnownWebAppBuild: 'synthetic-build',
    });
  });

  it('joins duplicate cases to their local card names', async () => {
    const database = createDatabase();
    const context = await ensureSelectedCardContext(database, visibleCard(), {
      now: () => new Date(observedAt),
    });
    if (context.cardDefinition === null) {
      throw new Error('Expected local definition.');
    }
    await database.duplicateCases.add({
      id: '4cc7d5be-711c-423d-a8bb-d23351140ac4',
      profileId: context.profile.id,
      cardDefinitionId: context.cardDefinition.id,
      existingOwnedCardId: context.ownedCard?.id,
      tradeability: 'untradeable',
      state: 'detected',
      detectedAt: observedAt,
      updatedAt: observedAt,
    });

    expect(await getDuplicateQueueRows(database)).toMatchObject([
      {
        cardName: 'Workspace Example',
        protected: false,
        protectingTagNames: [],
      },
    ]);

    const protectingTag = (await database.personalTags.toArray()).find(
      (tag) => tag.protectsCard,
    );
    if (context.ownedCard === null || protectingTag === undefined) {
      throw new Error('Expected an owned card and protecting tag.');
    }
    await updateOwnedCardPersonalization(database, {
      ownedCardId: context.ownedCard.id,
      personalTagIds: [protectingTag.id],
      notes: '',
    });
    expect(await getDuplicateQueueRows(database)).toMatchObject([
      {
        protected: true,
        protectingTagNames: [protectingTag.name],
      },
    ]);
  });

  it('fails closed when visible SBC card protection is unresolved or active', async () => {
    const database = createDatabase();
    const card = visibleCard();
    const context = await ensureSelectedCardContext(database, card, {
      now: () => new Date(observedAt),
    });
    if (context.ownedCard === null) {
      throw new Error('Expected local owned card.');
    }
    const protectingTag = (await database.personalTags.toArray()).find(
      (tag) => tag.protectsCard,
    );
    if (protectingTag === undefined) {
      throw new Error('Expected a default protecting tag.');
    }
    await updateOwnedCardPersonalization(database, {
      ownedCardId: context.ownedCard.id,
      personalTagIds: [protectingTag.id],
      notes: '',
    });

    expect(await scanVisibleCardProtection(database, [card])).toMatchObject([
      {
        localObservationId: card.localObservationId,
        cardName: 'Workspace Example',
        status: 'protected',
        protectingTagNames: [protectingTag.name],
      },
    ]);

    const unmatched = visibleCard();
    unmatched.localObservationId = '4805e3d5-1086-419c-8ea4-2871d4722ce0';
    unmatched.name = known('Unmatched Example');
    expect(
      await scanVisibleCardProtection(database, [unmatched]),
    ).toMatchObject([
      {
        localObservationId: unmatched.localObservationId,
        cardName: 'Unmatched Example',
        status: 'unresolved',
      },
    ]);
  });
});
