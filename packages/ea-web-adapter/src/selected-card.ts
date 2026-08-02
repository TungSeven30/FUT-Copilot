import {
  adapterDegradedEventSchema,
  cardSelectedEventSchema,
  type NormalizedAdapterEvent,
} from '@fut-copilot/domain/adapter-events';

import { ADAPTER_VERSION } from './adapter-version';
import { extractDetailedVisibleCard } from './detailed-card';
import { classifyScreen } from './screen-classifier';

export { ADAPTER_VERSION } from './adapter-version';

const ACTIVE_CARD_SELECTOR =
  '.DetailView .detail-carousel .tns-slide-active > .item.player.ut-item-loaded';

type ExtractSelectedCardOptions = {
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
  screen: 'club' | 'unknown',
  reasonCodes: string[],
  observedAt: string,
  createId: () => string,
) {
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

export function extractSelectedCardEvent(
  document: Document,
  options: ExtractSelectedCardOptions = {},
): NormalizedAdapterEvent {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const observedAt = (options.now ?? (() => new Date()))().toISOString();
  const classification = classifyScreen(document);

  if (classification.screen !== 'club') {
    return createDegradedEvent(
      'unknown',
      ['unsupported-screen'],
      observedAt,
      createId,
    );
  }

  const detailViews = document.querySelectorAll('.DetailView');
  if (detailViews.length === 0) {
    return cardSelectedEventSchema.parse({
      eventVersion: 1,
      eventId: createId(),
      type: 'card.selected',
      webAppBuild: unknownString(observedAt),
      occurredAt: observedAt,
      confidence: classification.confidence,
      extractionStatus: 'unknown',
      adapterVersion: ADAPTER_VERSION,
      payload: { screen: 'club', card: null },
    });
  }

  if (detailViews.length !== 1) {
    return createDegradedEvent(
      'club',
      ['multiple-detail-views'],
      observedAt,
      createId,
    );
  }

  const activeCards = document.querySelectorAll(ACTIVE_CARD_SELECTOR);
  if (activeCards.length !== 1) {
    return createDegradedEvent(
      'club',
      ['active-card-anchor-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }

  const cardElement = activeCards[0];
  if (cardElement === undefined) {
    return createDegradedEvent(
      'club',
      ['active-card-anchor-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }

  const detailedCard = extractDetailedVisibleCard({
    document,
    cardElement,
    createId,
    observedAt,
    tradeabilityContext: 'visible-detail-actions',
  });
  if (detailedCard.card === null) {
    return createDegradedEvent(
      'club',
      detailedCard.reasonCodes,
      observedAt,
      createId,
    );
  }

  return cardSelectedEventSchema.parse({
    eventVersion: 1,
    eventId: createId(),
    type: 'card.selected',
    webAppBuild: unknownString(observedAt),
    occurredAt: observedAt,
    confidence: 0.92,
    extractionStatus: 'known',
    adapterVersion: ADAPTER_VERSION,
    payload: {
      screen: 'club',
      card: detailedCard.card,
    },
  });
}
