import {
  breakEvenListPrice,
  calculateMarket,
  netSaleProceeds,
  roundUpToTransferPrice,
  summarizeMarketJournal,
} from './market';

describe('PlayStation market calculator', () => {
  it('calculates the default five-percent net proceeds', () => {
    expect(netSaleProceeds(10_000)).toBe(9_500);
    expect(netSaleProceeds(1_100)).toBe(1_045);
  });

  it('rounds up to a valid transfer-market price step', () => {
    expect(roundUpToTransferPrice(975)).toBe(1_000);
    expect(roundUpToTransferPrice(1_001)).toBe(1_100);
    expect(roundUpToTransferPrice(10_001)).toBe(10_250);
  });

  it('returns the first list price that actually breaks even after tax', () => {
    expect(breakEvenListPrice(10_000)).toBe(10_750);
    expect(netSaleProceeds(breakEvenListPrice(10_000))).toBeGreaterThanOrEqual(
      10_000,
    );
  });

  it('separates missing and stale observations', () => {
    expect(calculateMarket({}).observationStatus).toBe('missing');
    expect(
      calculateMarket({
        observedPrice: 20_000,
        observedAt: '2026-08-01T00:00:00.000Z',
        now: new Date('2026-08-03T00:00:00.000Z'),
      }).observationStatus,
    ).toBe('stale');
  });

  it('does not invent profit without both sale and purchase values', () => {
    expect(
      calculateMarket({ observedPrice: 20_000 }).estimatedProfitLoss,
    ).toBeNull();
  });

  it('keeps estimated and realized journal results separate', () => {
    const estimated = summarizeMarketJournal([
      { transactionType: 'purchased', amount: 10_000 },
      { transactionType: 'listed', amount: 12_000 },
    ]);
    const realized = summarizeMarketJournal([
      { transactionType: 'purchased', amount: 10_000 },
      { transactionType: 'sold', amount: 12_000 },
    ]);

    expect(estimated.estimatedProfitLoss).toBe(1_400);
    expect(estimated.realizedProfitLoss).toBeNull();
    expect(realized.realizedProfitLoss).toBe(1_400);
    expect(realized.estimatedProfitLoss).toBeNull();
  });

  it('uses the first target and listing when entries are newest-first', () => {
    const summary = summarizeMarketJournal([
      { transactionType: 'listed', amount: 15_000 },
      { transactionType: 'target-created', amount: 14_000 },
      { transactionType: 'listed', amount: 12_000 },
      { transactionType: 'target-created', amount: 11_000 },
      { transactionType: 'purchased', amount: 10_000 },
    ]);

    expect(summary.latestTarget).toBe(14_000);
    expect(summary.estimatedProfitLoss).toBe(4_250);
  });
});
