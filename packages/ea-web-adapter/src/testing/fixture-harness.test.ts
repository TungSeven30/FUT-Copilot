import {
  normalizedAdapterEventSchema,
  type NormalizedAdapterEvent,
} from '@fut-copilot/domain/adapter-events';

import selectedCardFixture from '../../../../fixtures/ea-web/selected-card/basic.json';
import { FixtureHarness } from './fixture-harness';

const observedAt = '2026-08-01T15:00:00.000Z';

function known<TValue>(value: TValue) {
  return {
    value,
    source: 'fixture' as const,
    observedAt,
    status: 'known' as const,
  };
}

function extractSelectedCard(document: Document): NormalizedAdapterEvent[] {
  const card = document.querySelector<HTMLElement>('[data-fixture-card]');
  if (card === null) {
    return [];
  }

  const event = normalizedAdapterEventSchema.parse({
    eventVersion: 1,
    eventId: 'b3ef63a8-e08d-4246-a36e-468effd095c2',
    type: 'card.selected',
    webAppBuild: {
      value: null,
      source: 'fixture',
      observedAt,
      status: 'unknown',
    },
    occurredAt: observedAt,
    confidence: 1,
    extractionStatus: 'known',
    adapterVersion: 'fixture-test-v1',
    payload: {
      card: {
        localObservationId: '651d458f-dbe0-4792-8fc1-2baf53a50414',
        name: known(card.dataset['name'] ?? ''),
        overall: known(Number(card.dataset['overall'])),
        position: known(card.dataset['position'] ?? ''),
        club: known(card.dataset['club'] ?? ''),
        league: known(card.dataset['league'] ?? ''),
        nation: known(card.dataset['nation'] ?? ''),
        rarity: known(card.dataset['rarity'] ?? ''),
        tradeability: known('tradeable'),
      },
    },
  });

  return [event];
}

describe('FixtureHarness', () => {
  it('loads a fixture, applies timed mutations, and exposes normalized events', () => {
    const harness = new FixtureHarness<NormalizedAdapterEvent>(
      selectedCardFixture,
      extractSelectedCard,
    );

    expect(harness.load()).toEqual([]);
    expect(harness.advanceTo(99)).toEqual([]);

    const emitted = harness.advanceTo(100);

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.type).toBe('card.selected');
    expect(harness.events).toHaveLength(1);
  });

  it('rejects time travel', () => {
    const harness = new FixtureHarness(selectedCardFixture, () => []);
    harness.load();
    harness.advanceTo(100);

    expect(() => harness.advanceTo(50)).toThrow('cannot move backwards');
  });
});
