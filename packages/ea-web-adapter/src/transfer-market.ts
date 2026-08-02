import {
  adapterDegradedEventSchema,
  marketContextVisibleEventSchema,
  type NormalizedAdapterEvent,
} from '@fut-copilot/domain/adapter-events';

import { ADAPTER_VERSION } from './adapter-version';
import { extractDetailedVisibleCard } from './detailed-card';
import { classifyScreen } from './screen-classifier';

const RESULTS_SELECTOR = '.ut-pinned-list-container.SearchResults';
const SELECTED_ROW_SELECTOR = `${RESULTS_SELECTOR} .listFUTItem.has-auction-data.selected`;
const DETAIL_CARD_SELECTOR =
  '.ut-split-view.sidebar-right .DetailView .detail-carousel .tns-slide-active > .item.player.ut-item-loaded';
const AUCTION_PANEL_SELECTOR =
  '.ut-split-view.sidebar-right .DetailPanel .auctionInfo';
const BUY_NOW_SELECTOR =
  '.ut-split-view.sidebar-right .DetailPanel button.buyButton.currency-coins';

type ExtractTransferMarketOptions = {
  createId?: () => string;
  now?: () => Date;
};

function unknownString(observedAt: string) {
  return {
    value: null,
    source: 'ea-visible-ui' as const,
    observedAt,
    status: 'unknown' as const,
  };
}

function createDegradedEvent(
  screen: 'transfer-market' | 'unknown',
  reasonCodes: string[],
  observedAt: string,
  createId: () => string,
): NormalizedAdapterEvent {
  return adapterDegradedEventSchema.parse({
    eventVersion: 1,
    eventId: createId(),
    type: 'adapter.degraded',
    webAppBuild: unknownString(observedAt),
    occurredAt: observedAt,
    confidence: 0,
    extractionStatus: 'unknown',
    adapterVersion: ADAPTER_VERSION,
    payload: { screen, reasonCodes },
  });
}

function parseDisplayedCoins(value: string | null): number | null {
  const normalized = (value ?? '').trim().replace(/,/g, '');
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseBuyNowCoins(value: string | null): number | null {
  const match = /^Buy Now for\s+([\d,]+)$/.exec((value ?? '').trim());
  return match?.[1] === undefined ? null : parseDisplayedCoins(match[1]);
}

function coinObservation(value: number, observedAt: string, evidence: string) {
  return {
    value,
    source: 'ea-visible-ui' as const,
    observedAt,
    status: 'known' as const,
    evidence: [evidence],
  };
}

export function extractTransferMarketEvent(
  document: Document,
  options: ExtractTransferMarketOptions = {},
): NormalizedAdapterEvent {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const observedAt = (options.now ?? (() => new Date()))().toISOString();
  const classification = classifyScreen(document);
  if (classification.screen !== 'transfer-market') {
    return createDegradedEvent(
      'unknown',
      ['unsupported-screen'],
      observedAt,
      createId,
    );
  }

  const resultContainers = document.querySelectorAll(RESULTS_SELECTOR);
  const selectedRows = document.querySelectorAll(SELECTED_ROW_SELECTOR);
  if (resultContainers.length !== 1 || selectedRows.length !== 1) {
    return createDegradedEvent(
      'transfer-market',
      ['selected-market-result-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }

  const detailViews = document.querySelectorAll(
    '.ut-split-view.sidebar-right .DetailView',
  );
  const activeCards = document.querySelectorAll(DETAIL_CARD_SELECTOR);
  if (detailViews.length !== 1 || activeCards.length !== 1) {
    return createDegradedEvent(
      'transfer-market',
      ['active-market-card-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }
  const activeCard = activeCards[0];
  if (activeCard === undefined) {
    return createDegradedEvent(
      'transfer-market',
      ['active-market-card-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }

  const card = extractDetailedVisibleCard({
    document,
    cardElement: activeCard,
    createId,
    observedAt,
    tradeabilityContext: 'transfer-market',
  });
  if (card.card === null) {
    return createDegradedEvent(
      'transfer-market',
      card.reasonCodes,
      observedAt,
      createId,
    );
  }

  const auctionPanels = document.querySelectorAll(AUCTION_PANEL_SELECTOR);
  const buyNowButtons = document.querySelectorAll(BUY_NOW_SELECTOR);
  if (auctionPanels.length !== 1 || buyNowButtons.length !== 1) {
    return createDegradedEvent(
      'transfer-market',
      ['market-price-anchors-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }
  const auctionPanel = auctionPanels[0];
  const buyNowButton = buyNowButtons[0];
  if (auctionPanel === undefined || buyNowButton === undefined) {
    return createDegradedEvent(
      'transfer-market',
      ['market-price-anchors-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }

  const startPriceAnchors = auctionPanel.querySelectorAll(
    '.currentBid.column .currency-coins.subContent',
  );
  const startPriceLabels = auctionPanel.querySelectorAll(
    '.currentBid.column .subHeading',
  );
  const startPriceLabel = (startPriceLabels[0]?.textContent ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  const startPrice = parseDisplayedCoins(
    startPriceAnchors[0]?.textContent ?? null,
  );
  const buyNowPrice = parseBuyNowCoins(buyNowButton.textContent);
  if (
    startPriceAnchors.length !== 1 ||
    startPriceLabels.length !== 1 ||
    startPriceLabel !== 'Start Price:' ||
    startPrice === null ||
    buyNowPrice === null
  ) {
    return createDegradedEvent(
      'transfer-market',
      ['market-price-values-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }

  return marketContextVisibleEventSchema.parse({
    eventVersion: 1,
    eventId: createId(),
    type: 'marketContext.visible',
    webAppBuild: unknownString(observedAt),
    occurredAt: observedAt,
    confidence: 0.95,
    extractionStatus: 'known',
    adapterVersion: ADAPTER_VERSION,
    payload: {
      selectedCard: card.card,
      displayedPrices: [
        coinObservation(
          startPrice,
          observedAt,
          'visible-transfer-market-start-price',
        ),
        coinObservation(
          buyNowPrice,
          observedAt,
          'visible-transfer-market-buy-now-price',
        ),
      ],
    },
  });
}
