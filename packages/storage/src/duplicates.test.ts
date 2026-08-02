import type { NormalizedAdapterEvent } from '@fut-copilot/domain/adapter-events';

import { FutCopilotDatabase } from './database';
import {
  createDuplicateCaseFromEvent,
  resolveDuplicateCase,
  updateDuplicateCaseState,
} from './duplicates';
import { persistNormalizedAdapterEvent } from './observations';

const databases: FutCopilotDatabase[] = [];
const observedAt = '2026-08-01T15:00:00.000Z';
const unknown = {
  value: null,
  source: 'fixture' as const,
  observedAt,
  status: 'unknown' as const,
};
const duplicateEvent: Extract<
  NormalizedAdapterEvent,
  { type: 'duplicate.detected' }
> = {
  eventVersion: 1,
  eventId: 'a83fbd35-2a35-4306-9e79-01d2422bb706',
  type: 'duplicate.detected',
  webAppBuild: unknown,
  occurredAt: observedAt,
  confidence: 0.95,
  extractionStatus: 'known',
  adapterVersion: 'fixture-v1',
  payload: {
    duplicate: {
      localObservationId: '58e65143-903d-461e-beca-768d206025f6',
      name: { ...unknown, value: 'Alex Example', status: 'known' },
      overall: { ...unknown, value: 91, status: 'known' },
      position: { ...unknown, value: 'ST', status: 'known' },
      club: unknown,
      league: unknown,
      nation: unknown,
      rarity: { ...unknown, value: 'special', status: 'known' },
      tradeability: unknown,
      firstOwner: unknown,
      loan: { ...unknown, value: false, status: 'known' },
      faceStats: [],
    },
    existingCard: null,
  },
};

function createDatabase() {
  const database = new FutCopilotDatabase(
    `fut-copilot-duplicates-${crypto.randomUUID()}`,
  );
  databases.push(database);
  return database;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe('duplicate triage storage', () => {
  it('creates one idempotent case per adapter event', async () => {
    const database = createDatabase();
    const first = await createDuplicateCaseFromEvent(database, duplicateEvent, {
      now: () => new Date(observedAt),
    });
    const repeated = await createDuplicateCaseFromEvent(
      database,
      duplicateEvent,
      {
        now: () => new Date(observedAt),
      },
    );

    expect(first.status).toBe('created');
    expect(repeated.status).toBe('existing');
    expect(await database.duplicateCases.count()).toBe(1);
  });

  it('remains idempotent when the extension runtime emits a new event ID', async () => {
    const database = createDatabase();
    const firstEvent = (
      await persistNormalizedAdapterEvent(database, duplicateEvent)
    ).event;
    if (firstEvent.type !== 'duplicate.detected') {
      throw new Error('Expected a persisted duplicate event.');
    }
    const first = await createDuplicateCaseFromEvent(database, firstEvent, {
      now: () => new Date(observedAt),
    });
    const repeatedInput: typeof duplicateEvent = {
      ...duplicateEvent,
      eventId: '86466f5d-4fdc-44e9-a151-42864019b657',
      occurredAt: '2026-08-01T15:01:00.000Z',
    };
    const repeatedEvent = (
      await persistNormalizedAdapterEvent(database, repeatedInput)
    ).event;
    if (repeatedEvent.type !== 'duplicate.detected') {
      throw new Error('Expected a persisted duplicate event.');
    }
    const repeated = await createDuplicateCaseFromEvent(
      database,
      repeatedEvent,
      { now: () => new Date('2026-08-01T15:01:00.000Z') },
    );

    expect(first.status).toBe('created');
    expect(repeated.status).toBe('existing');
    expect(repeatedEvent.eventId).toBe(duplicateEvent.eventId);
    expect(await database.duplicateCases.count()).toBe(1);
    expect(await database.observations.count()).toBe(1);
  });

  it('stores an explicit user-confirmed resolution', async () => {
    const database = createDatabase();
    const created = await createDuplicateCaseFromEvent(
      database,
      duplicateEvent,
      {
        now: () => new Date(observedAt),
      },
    );
    if (created.status === 'ambiguous') {
      throw new Error('Expected a duplicate case.');
    }
    const destinationSelected = await updateDuplicateCaseState(database, {
      duplicateCaseId: created.duplicateCase.id,
      state: 'destination-selected',
      now: () => new Date(observedAt),
    });
    expect(destinationSelected.state).toBe('destination-selected');

    const resolved = await resolveDuplicateCase(database, {
      duplicateCaseId: created.duplicateCase.id,
      action: 'listed',
      notes: 'Recorded after listing manually in EA.',
      now: () => new Date(observedAt),
    });

    expect(resolved.state).toBe('resolved');
    expect(resolved.resolution).toMatchObject({
      action: 'listed',
      userConfirmed: true,
    });
  });
});
