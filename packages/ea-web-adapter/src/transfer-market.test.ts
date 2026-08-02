import liveMarketFixture from '../../../fixtures/ea-web/market/live-search-results-contract.json';

import { classifyScreen } from './screen-classifier';
import { FixtureHarness } from './testing/fixture-harness';
import { extractTransferMarketEvent } from './transfer-market';

const observedAt = '2026-08-01T22:00:00.000Z';

function createHarness() {
  const harness = new FixtureHarness(liveMarketFixture, () => []);
  harness.load();
  return harness;
}

function extract(document: Document) {
  return extractTransferMarketEvent(document, {
    now: () => new Date(observedAt),
  });
}

describe('live Transfer Market Search Results contract', () => {
  it('classifies one English Search Results view', () => {
    expect(classifyScreen(createHarness().fixtureDocument)).toEqual({
      screen: 'transfer-market',
      confidence: 0.99,
      evidenceCodes: [
        'transfer-market-results-heading-visible',
        'transfer-market-results-view-visible',
      ],
    });
  });

  it('emits one selected detailed card and ordered start/buy-now values', () => {
    const event = extract(createHarness().fixtureDocument);

    expect(event.type).toBe('marketContext.visible');
    if (event.type !== 'marketContext.visible') {
      throw new Error('Expected a marketContext.visible event.');
    }
    expect(event.payload.selectedCard).toMatchObject({
      name: { value: 'Alex Market', status: 'known' },
      overall: { value: 91, status: 'known' },
      position: { value: 'RW', status: 'known' },
      tradeability: {
        value: 'tradeable',
        status: 'inferred',
        evidence: ['visible-transfer-market-context'],
      },
    });
    expect(event.payload.displayedPrices).toMatchObject([
      {
        value: 12_000,
        evidence: ['visible-transfer-market-start-price'],
      },
      {
        value: 24_000,
        evidence: ['visible-transfer-market-buy-now-price'],
      },
    ]);
  });

  it('fails closed when the selected result is ambiguous', () => {
    const harness = createHarness();
    harness.fixtureDocument
      .querySelectorAll('.listFUTItem')[1]
      ?.classList.add('selected');

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('adapter.degraded');
    if (event.type === 'adapter.degraded') {
      expect(event.payload.reasonCodes).toEqual([
        'selected-market-result-missing-or-ambiguous',
      ]);
    }
  });

  it('fails closed when the selected detailed card is ambiguous', () => {
    const harness = createHarness();
    const slide = harness.fixtureDocument.querySelector('.tns-slide-active');
    const card = slide?.querySelector('.item.player.ut-item-loaded');
    if (slide === null || card === null || card === undefined) {
      throw new Error('Expected a synthetic active market card.');
    }
    slide.append(card.cloneNode(true));

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('adapter.degraded');
    if (event.type === 'adapter.degraded') {
      expect(event.payload.reasonCodes).toEqual([
        'active-market-card-missing-or-ambiguous',
      ]);
    }
  });

  it('fails closed when the buy-now label is absent or nonnumeric', () => {
    const harness = createHarness();
    harness.fixtureDocument
      .querySelector('.buyButton')
      ?.replaceChildren('Buy Now');

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('adapter.degraded');
    if (event.type === 'adapter.degraded') {
      expect(event.payload.reasonCodes).toEqual([
        'market-price-values-missing-or-ambiguous',
      ]);
    }
  });

  it('fails closed when the scoped start-price label changes', () => {
    const harness = createHarness();
    harness.fixtureDocument
      .querySelector('.currentBid.column .subHeading')
      ?.replaceChildren('Current Bid:');

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('adapter.degraded');
    if (event.type === 'adapter.degraded') {
      expect(event.payload.reasonCodes).toEqual([
        'market-price-values-missing-or-ambiguous',
      ]);
    }
  });
});
