export type MarketCalculationInput = {
  observedPrice?: number;
  purchasePrice?: number;
  targetSalePrice?: number;
  taxRate?: number;
  observedAt?: string;
  now?: Date;
  staleAfterHours?: number;
};

export type MarketCalculation = {
  taxRate: number;
  expectedNetProceeds: number | null;
  breakEvenListPrice: number | null;
  estimatedProfitLoss: number | null;
  observationAgeHours: number | null;
  observationStatus: 'missing' | 'fresh' | 'stale';
};

export type MarketJournalEntry = {
  transactionType:
    | 'target-created'
    | 'purchased'
    | 'listed'
    | 'sold'
    | 'expired'
    | 'abandoned';
  amount: number;
  eaTax?: number | undefined;
};

export type MarketJournalSummary = {
  realizedProfitLoss: number | null;
  estimatedProfitLoss: number | null;
  purchaseTotal: number;
  realizedNetSales: number;
  latestTarget: number | null;
};

function assertCoinAmount(value: number | undefined, label: string): void {
  if (
    value !== undefined &&
    (!Number.isInteger(value) || value < 0 || value > 15_000_000)
  ) {
    throw new Error(`${label} must be a whole coin amount.`);
  }
}

export function transferMarketIncrement(amount: number): number {
  if (amount < 1_000) return 50;
  if (amount < 10_000) return 100;
  if (amount < 50_000) return 250;
  if (amount < 100_000) return 500;
  return 1_000;
}

export function roundUpToTransferPrice(amount: number): number {
  let candidate = Math.max(0, Math.ceil(amount));
  for (;;) {
    const increment = transferMarketIncrement(candidate);
    const rounded = Math.ceil(candidate / increment) * increment;
    if (transferMarketIncrement(rounded) === increment) {
      return rounded;
    }
    candidate = rounded;
  }
}

export function netSaleProceeds(salePrice: number, taxRate = 0.05): number {
  assertCoinAmount(salePrice, 'Sale price');
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate >= 1) {
    throw new Error('Tax rate must be at least 0 and below 1.');
  }
  return Math.floor(salePrice * (1 - taxRate));
}

export function breakEvenListPrice(
  purchasePrice: number,
  taxRate = 0.05,
): number {
  assertCoinAmount(purchasePrice, 'Purchase price');
  let candidate = roundUpToTransferPrice(purchasePrice / (1 - taxRate));
  while (netSaleProceeds(candidate, taxRate) < purchasePrice) {
    candidate += transferMarketIncrement(candidate);
  }
  return candidate;
}

export function calculateMarket(
  input: MarketCalculationInput,
): MarketCalculation {
  assertCoinAmount(input.observedPrice, 'Observed price');
  assertCoinAmount(input.purchasePrice, 'Purchase price');
  assertCoinAmount(input.targetSalePrice, 'Target sale price');
  const taxRate = input.taxRate ?? 0.05;
  const salePrice = input.targetSalePrice ?? input.observedPrice;
  const expectedNetProceeds =
    salePrice === undefined ? null : netSaleProceeds(salePrice, taxRate);
  const purchasePrice = input.purchasePrice;
  const observationAgeHours =
    input.observedAt === undefined
      ? null
      : Math.max(
          0,
          ((input.now ?? new Date()).getTime() -
            new Date(input.observedAt).getTime()) /
            3_600_000,
        );
  const staleAfterHours = input.staleAfterHours ?? 24;

  return {
    taxRate,
    expectedNetProceeds,
    breakEvenListPrice:
      purchasePrice === undefined
        ? null
        : breakEvenListPrice(purchasePrice, taxRate),
    estimatedProfitLoss:
      expectedNetProceeds === null || purchasePrice === undefined
        ? null
        : expectedNetProceeds - purchasePrice,
    observationAgeHours,
    observationStatus:
      input.observedPrice === undefined || observationAgeHours === null
        ? 'missing'
        : observationAgeHours > staleAfterHours
          ? 'stale'
          : 'fresh',
  };
}

export function summarizeMarketJournal(
  entries: MarketJournalEntry[],
  taxRate = 0.05,
): MarketJournalSummary {
  let purchaseTotal = 0;
  let realizedNetSales = 0;
  let latestTarget: number | null = null;
  let latestListing: number | null = null;

  for (const entry of entries) {
    if (entry.transactionType === 'purchased') {
      purchaseTotal += entry.amount;
    } else if (entry.transactionType === 'sold') {
      realizedNetSales +=
        entry.eaTax === undefined
          ? netSaleProceeds(entry.amount, taxRate)
          : entry.amount - entry.eaTax;
    } else if (
      entry.transactionType === 'target-created' &&
      latestTarget === null
    ) {
      latestTarget = entry.amount;
    } else if (entry.transactionType === 'listed' && latestListing === null) {
      latestListing = entry.amount;
    }
  }

  const estimatedSale = latestListing ?? latestTarget;
  return {
    realizedProfitLoss:
      purchaseTotal === 0 || realizedNetSales === 0
        ? null
        : realizedNetSales - purchaseTotal,
    estimatedProfitLoss:
      purchaseTotal === 0 || estimatedSale === null
        ? null
        : netSaleProceeds(estimatedSale, taxRate) - purchaseTotal,
    purchaseTotal,
    realizedNetSales,
    latestTarget,
  };
}
