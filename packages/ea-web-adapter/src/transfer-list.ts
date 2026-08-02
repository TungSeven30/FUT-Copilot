import {
  adapterDegradedEventSchema,
  marketContextVisibleEventSchema,
  type NormalizedAdapterEvent,
} from '@fut-copilot/domain/adapter-events';

import { ADAPTER_VERSION } from './adapter-version';
import { extractDetailedVisibleCard } from './detailed-card';
import { classifyScreen } from './screen-classifier';

const DETAIL_CARD_SELECTOR =
  '.ut-split-view.sidebar-right .DetailView .detail-carousel .tns-slide-active > .item.player.ut-item-loaded';
const AUCTION_PANEL_SELECTOR =
  '.ut-split-view.sidebar-right .DetailPanel .transferPanel.auctionInfo';

type ExtractTransferListOptions = {
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
  screen: 'transfer-list' | 'unknown',
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
  const normalized = (value ?? '').trim().replace(/[\s,]/g, '');
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function extractTransferListEvent(
  document: Document,
  options: ExtractTransferListOptions = {},
): NormalizedAdapterEvent {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const observedAt = (options.now ?? (() => new Date()))().toISOString();
  const classification = classifyScreen(document);
  if (classification.screen !== 'transfer-list') {
    return createDegradedEvent(
      'unknown',
      ['unsupported-screen'],
      observedAt,
      createId,
    );
  }

  const detailViews = document.querySelectorAll(
    '.ut-split-view.sidebar-right .DetailView',
  );
  if (detailViews.length === 0) {
    return marketContextVisibleEventSchema.parse({
      eventVersion: 1,
      eventId: createId(),
      type: 'marketContext.visible',
      webAppBuild: unknownString(observedAt),
      occurredAt: observedAt,
      confidence: classification.confidence,
      extractionStatus: 'known',
      adapterVersion: ADAPTER_VERSION,
      payload: { selectedCard: null, displayedPrices: [] },
    });
  }
  if (detailViews.length !== 1) {
    return createDegradedEvent(
      'transfer-list',
      ['multiple-transfer-detail-views'],
      observedAt,
      createId,
    );
  }

  const activeCards = document.querySelectorAll(DETAIL_CARD_SELECTOR);
  if (activeCards.length !== 1) {
    return createDegradedEvent(
      'transfer-list',
      ['active-transfer-card-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }
  const activeCard = activeCards[0];
  if (activeCard === undefined) {
    return createDegradedEvent(
      'transfer-list',
      ['active-transfer-card-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }

  const card = extractDetailedVisibleCard({
    document,
    cardElement: activeCard,
    createId,
    observedAt,
    tradeabilityContext: 'transfer-list',
  });
  if (card.card === null) {
    return createDegradedEvent(
      'transfer-list',
      card.reasonCodes,
      observedAt,
      createId,
    );
  }

  const auctionPanels = document.querySelectorAll(AUCTION_PANEL_SELECTOR);
  if (auctionPanels.length !== 1) {
    return createDegradedEvent(
      'transfer-list',
      ['auction-panel-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }
  const auctionPanel = auctionPanels[0];
  if (auctionPanel === undefined) {
    return createDegradedEvent(
      'transfer-list',
      ['auction-panel-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }
  const displayedPrices = Array.from(
    auctionPanel.querySelectorAll('.currency-coins.subContent'),
  ).flatMap((element) => {
    const price = parseDisplayedCoins(element.textContent);
    return price === null
      ? []
      : [
          {
            value: price,
            source: 'ea-visible-ui' as const,
            observedAt,
            status: 'known' as const,
            evidence: ['visible-transfer-list-coin-value'],
          },
        ];
  });

  return marketContextVisibleEventSchema.parse({
    eventVersion: 1,
    eventId: createId(),
    type: 'marketContext.visible',
    webAppBuild: unknownString(observedAt),
    occurredAt: observedAt,
    confidence: 0.94,
    extractionStatus: 'known',
    adapterVersion: ADAPTER_VERSION,
    payload: { selectedCard: card.card, displayedPrices },
  });
}
