import liveTransferListFixture from '../../../fixtures/ea-web/market/live-transfer-list-contract.json';

import { classifyScreen } from './screen-classifier';
import { FixtureHarness } from './testing/fixture-harness';
import { extractTransferListEvent } from './transfer-list';

const observedAt = '2026-08-01T20:00:00.000Z';

function createHarness() {
  const harness = new FixtureHarness(liveTransferListFixture, () => []);
  harness.load();
  return harness;
}

function extract(document: Document) {
  return extractTransferListEvent(document, {
    now: () => new Date(observedAt),
  });
}

describe('live Transfer List contract', () => {
  it('classifies one English Transfer List view', () => {
    const harness = createHarness();

    expect(classifyScreen(harness.fixtureDocument)).toEqual({
      screen: 'transfer-list',
      confidence: 0.99,
      evidenceCodes: [
        'transfer-list-heading-visible',
        'transfer-list-view-visible',
      ],
    });
  });

  it('emits the selected visible card and scoped displayed coin values', () => {
    const event = extract(createHarness().fixtureDocument);

    expect(event.type).toBe('marketContext.visible');
    if (event.type !== 'marketContext.visible') {
      throw new Error('Expected a marketContext.visible event.');
    }
    expect(event.payload.selectedCard).toMatchObject({
      name: { value: 'Alex Transfer', status: 'known' },
      overall: { value: 90, status: 'known' },
      position: { value: 'CM', status: 'known' },
      rarity: { value: 'special', status: 'inferred' },
      tradeability: {
        value: 'tradeable',
        status: 'inferred',
        evidence: ['visible-transfer-list-context'],
      },
      firstOwner: { value: true, status: 'inferred' },
    });
    expect(
      event.payload.displayedPrices.map((observation) => observation.value),
    ).toEqual([120_000, 135_000]);
  });

  it('emits a known empty context when the list has no detail view', () => {
    const harness = createHarness();
    harness.fixtureDocument.querySelector('.DetailView')?.remove();

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('marketContext.visible');
    if (event.type === 'marketContext.visible') {
      expect(event.payload).toEqual({
        selectedCard: null,
        displayedPrices: [],
      });
    }
  });

  it('fails closed when more than one card is active', () => {
    const harness = createHarness();
    const activeSlide =
      harness.fixtureDocument.querySelector('.tns-slide-active');
    const card = activeSlide?.querySelector('.item.player.ut-item-loaded');
    if (activeSlide === null || card === null || card === undefined) {
      throw new Error('Expected an active synthetic transfer card.');
    }
    activeSlide.append(card.cloneNode(true));

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('adapter.degraded');
    if (event.type === 'adapter.degraded') {
      expect(event.payload.reasonCodes).toEqual([
        'active-transfer-card-missing-or-ambiguous',
      ]);
    }
  });

  it('fails closed when the auction panel is missing', () => {
    const harness = createHarness();
    harness.fixtureDocument
      .querySelector('.transferPanel.auctionInfo')
      ?.remove();

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('adapter.degraded');
    if (event.type === 'adapter.degraded') {
      expect(event.payload.reasonCodes).toEqual([
        'auction-panel-missing-or-ambiguous',
      ]);
    }
  });

  it('ignores a nonnumeric placeholder instead of coercing it to zero', () => {
    const harness = createHarness();
    const prices = harness.fixtureDocument.querySelectorAll(
      '.currency-coins.subContent',
    );
    prices[0]?.replaceChildren('---');

    const event = extract(harness.fixtureDocument);
    if (event.type !== 'marketContext.visible') {
      throw new Error('Expected a marketContext.visible event.');
    }
    expect(
      event.payload.displayedPrices.map((observation) => observation.value),
    ).toEqual([135_000]);
  });
});
