import {
  adapterDegradedEventSchema,
  cardSelectedEventSchema,
  type NormalizedAdapterEvent,
} from '@fut-copilot/domain/adapter-events';

import { ADAPTER_VERSION } from './adapter-version';
import { classifyScreen } from './screen-classifier';

export { ADAPTER_VERSION } from './adapter-version';

const ACTIVE_CARD_SELECTOR =
  '.DetailView .detail-carousel .tns-slide-active > .item.player.ut-item-loaded';
const FACE_STAT_LABELS = new Set([
  'PAC',
  'SHO',
  'PAS',
  'DRI',
  'DEF',
  'PHY',
  'DIV',
  'HAN',
  'KIC',
  'REF',
  'SPD',
  'POS',
]);

type ExtractSelectedCardOptions = {
  createId?: () => string;
  now?: () => Date;
};

function normalizeText(value: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function textFrom(root: Element, selector: string): string {
  return normalizeText(root.querySelector(selector)?.textContent ?? null);
}

function parseRating(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 99
    ? parsed
    : null;
}

function isVisible(element: Element): boolean {
  if (element.getAttribute('data-fcp-visible') === 'true') {
    return true;
  }

  const view = element.ownerDocument.defaultView;
  if (view === null) {
    return false;
  }

  const style = view.getComputedStyle(element);
  const bounds = element.getBoundingClientRect();
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    bounds.width > 0 &&
    bounds.height > 0
  );
}

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

  if (cardElement.classList.contains('concept')) {
    return createDegradedEvent(
      'club',
      ['concept-card-not-owned'],
      observedAt,
      createId,
    );
  }

  const name = textFrom(cardElement, '.name.main-view');
  const overall = parseRating(textFrom(cardElement, '.rating'));
  const position = textFrom(cardElement, '.position');
  const missingFields = [
    ...(name === '' ? ['name'] : []),
    ...(overall === null ? ['overall'] : []),
    ...(position === '' ? ['position'] : []),
  ];

  if (missingFields.length > 0) {
    return createDegradedEvent(
      'club',
      missingFields.map((field) => `missing-${field}`),
      observedAt,
      createId,
    );
  }

  const faceStats: Array<{
    label:
      | 'PAC'
      | 'SHO'
      | 'PAS'
      | 'DRI'
      | 'DEF'
      | 'PHY'
      | 'DIV'
      | 'HAN'
      | 'KIC'
      | 'REF'
      | 'SPD'
      | 'POS';
    value: number;
  }> = [];
  for (const row of cardElement.querySelectorAll('.item-view--player-stat')) {
    const label = textFrom(row, '.statLabel');
    const value = parseRating(textFrom(row, '.statValue'));
    if (FACE_STAT_LABELS.has(label) && value !== null) {
      faceStats.push({
        label: label as (typeof faceStats)[number]['label'],
        value,
      });
    }
    if (faceStats.length === 6) {
      break;
    }
  }

  const visibleActionLabels = Array.from(
    document.querySelectorAll('.DetailPanel button'),
  )
    .filter(isVisible)
    .map(
      (button) =>
        textFrom(button, '.btn-text') || normalizeText(button.textContent),
    );
  const hasTransferAction = visibleActionLabels.some(
    (label) =>
      label === 'List on Transfer Market' || label === 'Send to Transfer List',
  );
  const firstOwnerMarker = cardElement.querySelector(
    '.icon_chemistry_first_owner',
  );
  const isFirstOwner = firstOwnerMarker !== null && isVisible(firstOwnerMarker);
  const rarityValue = cardElement.classList.contains('specials')
    ? 'special'
    : cardElement.classList.contains('rare')
      ? 'rare'
      : null;

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
      card: {
        localObservationId: createId(),
        name: {
          value: name,
          source: 'ea-visible-ui',
          observedAt,
          status: 'known',
          evidence: ['active-card-name'],
        },
        overall: {
          value: overall,
          source: 'ea-visible-ui',
          observedAt,
          status: 'known',
          evidence: ['active-card-rating'],
        },
        position: {
          value: position,
          source: 'ea-visible-ui',
          observedAt,
          status: 'known',
          evidence: ['active-card-position'],
        },
        club: unknownString(observedAt),
        league: unknownString(observedAt),
        nation: unknownString(observedAt),
        rarity:
          rarityValue === null
            ? unknownString(observedAt)
            : {
                value: rarityValue,
                source: 'ea-visible-ui',
                observedAt,
                status: 'inferred',
                evidence: ['active-card-rarity-class'],
              },
        tradeability: hasTransferAction
          ? {
              value: 'tradeable',
              source: 'ea-visible-ui',
              observedAt,
              status: 'inferred',
              evidence: ['visible-manual-transfer-action'],
            }
          : {
              value: null,
              source: 'ea-visible-ui',
              observedAt,
              status: 'unknown',
              evidence: ['no-visible-transfer-action'],
            },
        firstOwner: isFirstOwner
          ? {
              value: true,
              source: 'ea-visible-ui',
              observedAt,
              status: 'inferred',
              evidence: ['visible-first-owner-marker'],
            }
          : {
              value: null,
              source: 'ea-visible-ui',
              observedAt,
              status: 'unknown',
            },
        loan: {
          value: cardElement.classList.contains('loan'),
          source: 'ea-visible-ui',
          observedAt,
          status: 'inferred',
          evidence: ['active-card-loan-class'],
        },
        faceStats,
      },
    },
  });
}
