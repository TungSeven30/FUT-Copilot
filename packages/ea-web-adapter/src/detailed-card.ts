import {
  visibleCardSchema,
  type VisibleCard,
} from '@fut-copilot/domain/adapter-events';

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

export type DetailedCardTradeabilityContext =
  'visible-detail-actions' | 'transfer-list' | 'transfer-market';

export type DetailedCardExtraction = {
  card: VisibleCard | null;
  reasonCodes: string[];
};

export function normalizeVisibleText(value: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function textFrom(root: Element, selector: string): string {
  return normalizeVisibleText(
    root.querySelector(selector)?.textContent ?? null,
  );
}

function parseRating(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 99
    ? parsed
    : null;
}

function isVisible(element: Element): boolean {
  if (element.getAttribute('data-fcp-visible') === 'true') return true;
  const view = element.ownerDocument.defaultView;
  if (view === null) return false;
  const style = view.getComputedStyle(element);
  const bounds = element.getBoundingClientRect();
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    bounds.width > 0 &&
    bounds.height > 0
  );
}

function unknownString(observedAt: string, evidence?: string[]) {
  return {
    value: null,
    source: 'ea-visible-ui' as const,
    observedAt,
    status: 'unknown' as const,
    ...(evidence === undefined ? {} : { evidence }),
  };
}

export function extractDetailedVisibleCard(input: {
  document: Document;
  cardElement: Element;
  createId: () => string;
  observedAt: string;
  tradeabilityContext: DetailedCardTradeabilityContext;
}): DetailedCardExtraction {
  const { document, cardElement, createId, observedAt, tradeabilityContext } =
    input;
  if (cardElement.classList.contains('concept')) {
    return { card: null, reasonCodes: ['concept-card-not-owned'] };
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
    return {
      card: null,
      reasonCodes: missingFields.map((field) => `missing-${field}`),
    };
  }

  const faceStats: VisibleCard['faceStats'] = [];
  for (const row of cardElement.querySelectorAll('.item-view--player-stat')) {
    const label = textFrom(row, '.statLabel');
    const value = parseRating(textFrom(row, '.statValue'));
    if (FACE_STAT_LABELS.has(label) && value !== null) {
      faceStats.push({
        label: label as (typeof faceStats)[number]['label'],
        value,
      });
    }
    if (faceStats.length === 6) break;
  }

  const visibleActionLabels = Array.from(
    document.querySelectorAll('.DetailPanel button'),
  )
    .filter(isVisible)
    .map(
      (button) =>
        textFrom(button, '.btn-text') ||
        normalizeVisibleText(button.textContent),
    );
  const hasTransferAction = visibleActionLabels.some(
    (label) =>
      label === 'List on Transfer Market' || label === 'Send to Transfer List',
  );
  const tradeable =
    tradeabilityContext === 'transfer-list' ||
    tradeabilityContext === 'transfer-market' ||
    hasTransferAction;
  const firstOwnerMarker = cardElement.querySelector(
    '.icon_chemistry_first_owner',
  );
  const firstOwner = firstOwnerMarker !== null && isVisible(firstOwnerMarker);
  const rarity = cardElement.classList.contains('specials')
    ? 'special'
    : cardElement.classList.contains('rare')
      ? 'rare'
      : null;

  return {
    reasonCodes: [],
    card: visibleCardSchema.parse({
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
        rarity === null
          ? unknownString(observedAt)
          : {
              value: rarity,
              source: 'ea-visible-ui',
              observedAt,
              status: 'inferred',
              evidence: ['active-card-rarity-class'],
            },
      tradeability: tradeable
        ? {
            value: 'tradeable',
            source: 'ea-visible-ui',
            observedAt,
            status: 'inferred',
            evidence: [
              tradeabilityContext === 'transfer-list'
                ? 'visible-transfer-list-context'
                : tradeabilityContext === 'transfer-market'
                  ? 'visible-transfer-market-context'
                  : 'visible-manual-transfer-action',
            ],
          }
        : {
            value: null,
            source: 'ea-visible-ui',
            observedAt,
            status: 'unknown',
            evidence: ['no-visible-transfer-action'],
          },
      firstOwner: firstOwner
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
    }),
  };
}
