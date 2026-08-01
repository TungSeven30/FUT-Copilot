import type {
  NormalizedAdapterEvent,
  VisibleCard,
} from '@fut-copilot/domain/adapter-events';
import type { Observation } from '@fut-copilot/domain/observation';

import { FutCopilotDatabase } from './database';
import { ensureSelectedCardContext } from './personalization';
import {
  getDuplicateQueueRows,
  getAdapterDiagnostics,
  getSbcInventory,
  getTableCounts,
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
      tradeability: 'untradeable',
      state: 'detected',
      detectedAt: observedAt,
      updatedAt: observedAt,
    });

    expect(await getDuplicateQueueRows(database)).toMatchObject([
      { cardName: 'Workspace Example' },
    ]);
  });
});
