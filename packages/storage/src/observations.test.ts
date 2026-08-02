import type { NormalizedAdapterEvent } from '@fut-copilot/domain/adapter-events';

import { FutCopilotDatabase } from './database';
import { persistNormalizedAdapterEvent } from './observations';

const databases: FutCopilotDatabase[] = [];

function degradedEvent(
  eventId: string,
  occurredAt: string,
  reasonCodes: string[],
): NormalizedAdapterEvent {
  return {
    eventVersion: 1,
    eventId,
    type: 'adapter.degraded',
    webAppBuild: {
      value: null,
      source: 'fixture',
      observedAt: occurredAt,
      status: 'unknown',
    },
    occurredAt,
    confidence: 0,
    extractionStatus: 'unknown',
    adapterVersion: 'fixture-v1',
    payload: { screen: 'unknown', reasonCodes },
  };
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe('normalized adapter observation persistence', () => {
  it('updates the latest identical observation across runtime restarts', async () => {
    const database = new FutCopilotDatabase(
      `fut-copilot-observations-${crypto.randomUUID()}`,
    );
    databases.push(database);
    const first = degradedEvent(
      'f8f4f889-4bbf-48d4-9ec2-d21300534d4d',
      '2026-08-01T15:00:00.000Z',
      ['unsupported-screen'],
    );
    const repeated = degradedEvent(
      '3abe1107-14c5-42c9-a9b0-a4e41cd9b459',
      '2026-08-01T15:01:00.000Z',
      ['unsupported-screen'],
    );

    expect((await persistNormalizedAdapterEvent(database, first)).status).toBe(
      'created',
    );
    const result = await persistNormalizedAdapterEvent(database, repeated);

    expect(result.status).toBe('updated');
    expect(result.event.eventId).toBe(first.eventId);
    expect(result.event.occurredAt).toBe(repeated.occurredAt);
    expect(await database.observations.count()).toBe(1);
  });

  it('keeps a new history row when normalized visible facts change', async () => {
    const database = new FutCopilotDatabase(
      `fut-copilot-observations-${crypto.randomUUID()}`,
    );
    databases.push(database);
    await persistNormalizedAdapterEvent(
      database,
      degradedEvent(
        '91306b4f-a275-45c4-a9ea-c4f7d8b7c70f',
        '2026-08-01T15:00:00.000Z',
        ['unsupported-screen'],
      ),
    );
    const changed = await persistNormalizedAdapterEvent(
      database,
      degradedEvent(
        '4bbbd54c-8495-43eb-89be-b0c59d81880b',
        '2026-08-01T16:00:00.000Z',
        ['active-card-anchor-missing-or-ambiguous'],
      ),
    );

    expect(changed.status).toBe('created');
    expect(await database.observations.count()).toBe(2);
  });

  it('keeps an identical occurrence outside the stability window', async () => {
    const database = new FutCopilotDatabase(
      `fut-copilot-observations-${crypto.randomUUID()}`,
    );
    databases.push(database);
    const first = degradedEvent(
      '172867e2-8540-4981-b04a-31561ba8ca46',
      '2026-08-01T15:00:00.000Z',
      ['unsupported-screen'],
    );
    const later = degradedEvent(
      'fd98fe97-c62b-4279-b4a1-ff4522ef5411',
      '2026-08-01T15:06:00.000Z',
      ['unsupported-screen'],
    );
    await persistNormalizedAdapterEvent(database, first);

    expect((await persistNormalizedAdapterEvent(database, later)).status).toBe(
      'created',
    );
    expect(await database.observations.count()).toBe(2);
  });
});
