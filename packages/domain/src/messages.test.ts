import type { NormalizedAdapterEvent } from './adapter-events';
import { adapterSnapshotSchema, createAdapterSnapshot } from './messages';

const timestamp = '2026-08-01T15:00:00.000Z';
const unknownBuild = {
  value: null,
  source: 'ea-visible-ui' as const,
  observedAt: timestamp,
  status: 'unknown' as const,
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
});
