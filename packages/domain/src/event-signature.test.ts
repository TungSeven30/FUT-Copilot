import type { NormalizedAdapterEvent } from './adapter-events';
import { createAdapterEventSignature } from './event-signature';

type ActiveSquadEvent = Extract<
  NormalizedAdapterEvent,
  { type: 'activeSquad.visible' }
>;

function activeSquadEvent(
  eventId: string,
  occurredAt: string,
): ActiveSquadEvent {
  return {
    eventVersion: 1,
    eventId,
    type: 'activeSquad.visible',
    webAppBuild: {
      value: null,
      source: 'fixture',
      observedAt: occurredAt,
      status: 'unknown',
    },
    occurredAt,
    confidence: 1,
    extractionStatus: 'known',
    adapterVersion: 'fixture-v1',
    payload: { slots: [] },
  };
}

describe('normalized adapter-event signature', () => {
  it('ignores generated identifiers and timestamps for every event type', () => {
    const first = activeSquadEvent(
      'fcbd4cbb-c500-42a2-8964-c3b062723106',
      '2026-08-01T15:00:00.000Z',
    );
    const repeated = activeSquadEvent(
      '95a5e54c-c9e0-4dd6-a11b-2efea1f72580',
      '2026-08-01T16:00:00.000Z',
    );

    expect(createAdapterEventSignature(repeated)).toBe(
      createAdapterEventSignature(first),
    );
  });

  it('preserves visible order and semantic facts', () => {
    const first = activeSquadEvent(
      '60852df8-fc44-4761-85d1-b51a95b3a634',
      '2026-08-01T15:00:00.000Z',
    );
    const changed = {
      ...first,
      confidence: 0.8,
    } satisfies NormalizedAdapterEvent;

    expect(createAdapterEventSignature(changed)).not.toBe(
      createAdapterEventSignature(first),
    );

    const ordered: ActiveSquadEvent = {
      ...first,
      payload: {
        slots: [
          { slot: 'starter-1', group: 'starting', card: null },
          { slot: 'bench-1', group: 'bench', card: null },
        ],
      },
    };
    const reversed: ActiveSquadEvent = {
      ...ordered,
      payload: { slots: [...ordered.payload.slots].reverse() },
    };
    expect(createAdapterEventSignature(reversed)).not.toBe(
      createAdapterEventSignature(ordered),
    );
  });
});
