import livePackResultFixture from '../../../fixtures/ea-web/pack-result/live-unassigned-contract.json';

import { extractPackResultEvent } from './pack-result';
import { classifyScreen } from './screen-classifier';
import { FixtureHarness } from './testing/fixture-harness';

const observedAt = '2026-08-02T16:00:00.000Z';

function createHarness() {
  const harness = new FixtureHarness(livePackResultFixture, () => []);
  harness.load();
  return harness;
}

function extract(document: Document) {
  return extractPackResultEvent(document, {
    now: () => new Date(observedAt),
  });
}

describe('live Unassigned pack-result contract', () => {
  it('classifies one English Unassigned view with an Items section', () => {
    expect(classifyScreen(createHarness().fixtureDocument)).toEqual({
      screen: 'pack-result',
      confidence: 0.99,
      evidenceCodes: [
        'unassigned-heading-visible',
        'unassigned-view-visible',
        'pack-items-section-visible',
      ],
    });
  });

  it('preserves item order followed by duplicate order and marks duplicates', () => {
    const event = extract(createHarness().fixtureDocument);

    expect(event.type).toBe('packResult.visible');
    if (event.type !== 'packResult.visible') {
      throw new Error('Expected a packResult.visible event.');
    }
    expect(event.payload.cards.map((card) => card.name.value)).toEqual([
      'Synthetic Item One',
      'Synthetic Item Two',
      'Synthetic Duplicate',
    ]);
    expect(event.payload.duplicateIndexes).toEqual([2]);
    expect(event.payload.cards[0]).toMatchObject({
      overall: { value: 83, status: 'known' },
      position: { value: 'CM', status: 'known' },
      firstOwner: { value: true, status: 'inferred' },
      tradeability: { value: null, status: 'unknown' },
    });
  });

  it('supports a result with no duplicate section', () => {
    const harness = createHarness();
    harness.fixtureDocument
      .querySelectorAll('.ut-sectioned-item-list-view')[1]
      ?.remove();

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('packResult.visible');
    if (event.type === 'packResult.visible') {
      expect(event.payload.cards).toHaveLength(2);
      expect(event.payload.duplicateIndexes).toEqual([]);
    }
  });

  it('fails closed when an item row is not fully loaded', () => {
    const harness = createHarness();
    harness.fixtureDocument
      .querySelector('.item.player.ut-item-loaded')
      ?.classList.remove('ut-item-loaded');

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('adapter.degraded');
    if (event.type === 'adapter.degraded') {
      expect(event.payload.reasonCodes).toEqual([
        'pack-card-1-anchors-missing-or-ambiguous',
      ]);
    }
  });

  it('fails closed when a card name is missing', () => {
    const harness = createHarness();
    harness.fixtureDocument.querySelector('.name')?.replaceChildren();

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('adapter.degraded');
    if (event.type === 'adapter.degraded') {
      expect(event.payload.reasonCodes).toEqual(['pack-card-1-missing-name']);
    }
  });

  it('fails closed when an unknown result section appears', () => {
    const harness = createHarness();
    harness.fixtureDocument
      .querySelector('.ut-section-header-view h2')
      ?.replaceChildren('Other items');

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('adapter.degraded');
    if (event.type === 'adapter.degraded') {
      expect(event.payload.reasonCodes).toEqual(['unsupported-screen']);
      expect(event.payload.screen).toBe('unknown');
    }
  });
});
