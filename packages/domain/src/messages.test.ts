import {
  packResultVisibleEventSchema,
  playerPickVisibleEventSchema,
  type NormalizedAdapterEvent,
} from './adapter-events';
import {
  adapterSnapshotSchema,
  createAdapterSnapshot,
  protectionStatusResponseSchema,
} from './messages';

const timestamp = '2026-08-01T15:00:00.000Z';
const unknownBuild = {
  value: null,
  source: 'ea-visible-ui' as const,
  observedAt: timestamp,
  status: 'unknown' as const,
};
const visiblePickOption = {
  localObservationId: '6cbe5309-17fe-4ec4-845a-fd69d67d24b7',
  name: {
    value: 'Pick Example',
    source: 'fixture' as const,
    observedAt: timestamp,
    status: 'known' as const,
  },
  overall: {
    value: 88,
    source: 'fixture' as const,
    observedAt: timestamp,
    status: 'known' as const,
  },
  position: {
    value: 'CM',
    source: 'fixture' as const,
    observedAt: timestamp,
    status: 'known' as const,
  },
  club: unknownBuild,
  league: unknownBuild,
  nation: unknownBuild,
  rarity: unknownBuild,
  tradeability: unknownBuild,
  firstOwner: unknownBuild,
  loan: {
    value: false,
    source: 'fixture' as const,
    observedAt: timestamp,
    status: 'known' as const,
  },
  faceStats: [],
};

function makeEvent(
  card: Extract<
    NormalizedAdapterEvent,
    { type: 'card.selected' }
  >['payload']['card'],
): NormalizedAdapterEvent {
  return {
    eventVersion: 1,
    eventId: 'c54a7012-455d-40ce-919e-ad4282e987ea',
    type: 'card.selected',
    webAppBuild: unknownBuild,
    occurredAt: timestamp,
    confidence: card === null ? 1 : 0.92,
    extractionStatus: card === null ? 'unknown' : 'known',
    adapterVersion: 'fc26-web-v0.1.0',
    payload: { screen: 'club', card },
  };
}

describe('adapter snapshots', () => {
  it('maps a null selected card to an explicit empty state', () => {
    const snapshot = createAdapterSnapshot(makeEvent(null));

    expect(snapshot?.state).toBe('empty');
    expect(adapterSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it('maps an unknown degraded screen to unsupported', () => {
    const event: NormalizedAdapterEvent = {
      eventVersion: 1,
      eventId: '4cc9a684-0889-43fa-9eb8-dd8923cf6739',
      type: 'adapter.degraded',
      webAppBuild: unknownBuild,
      occurredAt: timestamp,
      confidence: 0,
      extractionStatus: 'unknown',
      adapterVersion: 'fc26-web-v0.1.0',
      payload: { screen: 'unknown', reasonCodes: ['unsupported-screen'] },
    };

    expect(createAdapterSnapshot(event)?.state).toBe('unsupported');
  });

  it('validates normalized protection status without page data', () => {
    expect(
      protectionStatusResponseSchema.parse({
        kind: 'protection.status',
        status: 'protected',
        tagNames: ['favorite'],
      }),
    ).toMatchObject({ status: 'protected', tagNames: ['favorite'] });
  });

  it('rejects a player-pick selection outside the visible option list', () => {
    expect(
      playerPickVisibleEventSchema.safeParse({
        eventVersion: 1,
        eventId: 'e3b6f165-d697-4bbd-b0c3-5e7ba93aa1c7',
        type: 'playerPick.visible',
        webAppBuild: unknownBuild,
        occurredAt: timestamp,
        confidence: 0.9,
        extractionStatus: 'known',
        adapterVersion: 'synthetic-fixture-v1',
        payload: { options: [visiblePickOption], selectedIndex: 1 },
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate pack indexes outside the visible card list', () => {
    expect(
      packResultVisibleEventSchema.safeParse({
        eventVersion: 1,
        eventId: 'f96f56fc-f3d6-4f7d-929e-075953a61cc6',
        type: 'packResult.visible',
        webAppBuild: unknownBuild,
        occurredAt: timestamp,
        confidence: 0.9,
        extractionStatus: 'known',
        adapterVersion: 'synthetic-fixture-v1',
        payload: { cards: [visiblePickOption], duplicateIndexes: [1] },
      }).success,
    ).toBe(false);
  });
});
