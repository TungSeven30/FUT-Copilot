import {
  adapterDegradedEventSchema,
  packResultVisibleEventSchema,
  visibleCardSchema,
  type NormalizedAdapterEvent,
  type VisibleCard,
} from '@fut-copilot/domain/adapter-events';

import { ADAPTER_VERSION } from './adapter-version';
import { classifyScreen } from './screen-classifier';

const VIEW_SELECTOR = '.ut-unassigned-view.ui-layout-left';
const SECTION_SELECTOR = ':scope > .ut-sectioned-item-list-view';
const SECTION_HEADING_SELECTOR = ':scope > .ut-section-header-view h2';
const ROW_SELECTOR = ':scope > .itemList > .listFUTItem';
const CARD_SELECTOR =
  ':scope > .rowContent.has-tap-callback > .entityContainer > .item.player.ut-item-loaded';

type ExtractPackResultOptions = {
  createId?: () => string;
  now?: () => Date;
};

function normalizeText(value: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
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

function createDegradedEvent(
  screen: 'pack-result' | 'unknown',
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

function rarityObservation(card: Element, observedAt: string) {
  const recognized = ['specials', 'rare', 'common'].filter((className) =>
    card.classList.contains(className),
  );
  if (recognized.length !== 1) {
    return unknownString(observedAt, ['unrecognized-pack-card-rarity']);
  }
  return {
    value: recognized[0] === 'specials' ? 'special' : recognized[0],
    source: 'ea-visible-ui' as const,
    observedAt,
    status: 'inferred' as const,
    evidence: ['visible-pack-card-rarity-class'],
  };
}

function cardFromRow(
  row: Element,
  visibleIndex: number,
  observedAt: string,
  createId: () => string,
): { card: VisibleCard | null; reasonCodes: string[] } {
  const rowCode = `pack-card-${visibleIndex + 1}`;
  const cards = row.querySelectorAll(CARD_SELECTOR);
  const names = row.querySelectorAll(
    ':scope > .rowContent.has-tap-callback .name',
  );
  if (cards.length !== 1 || names.length !== 1) {
    return {
      card: null,
      reasonCodes: [`${rowCode}-anchors-missing-or-ambiguous`],
    };
  }
  const card = cards[0];
  if (card === undefined) {
    return {
      card: null,
      reasonCodes: [`${rowCode}-anchors-missing-or-ambiguous`],
    };
  }
  if (card.classList.contains('concept')) {
    return { card: null, reasonCodes: [`${rowCode}-concept-card-not-owned`] };
  }

  const ratingAnchors = card.querySelectorAll('.rating');
  const positionAnchors = card.querySelectorAll('.position');
  const name = normalizeText(names[0]?.textContent ?? null);
  const overall =
    ratingAnchors.length === 1
      ? parseRating(normalizeText(ratingAnchors[0]?.textContent ?? null))
      : null;
  const position =
    positionAnchors.length === 1
      ? normalizeText(positionAnchors[0]?.textContent ?? null)
      : '';
  const reasonCodes = [
    ...(name === '' ? [`${rowCode}-missing-name`] : []),
    ...(overall === null ? [`${rowCode}-missing-or-ambiguous-rating`] : []),
    ...(position === '' ? [`${rowCode}-missing-or-ambiguous-position`] : []),
  ];
  if (reasonCodes.length > 0) return { card: null, reasonCodes };

  const firstOwnerMarker = card.querySelector('.icon_chemistry_first_owner');
  const firstOwnerVisible =
    firstOwnerMarker !== null && isVisible(firstOwnerMarker);

  return {
    reasonCodes: [],
    card: visibleCardSchema.parse({
      localObservationId: createId(),
      name: {
        value: name,
        source: 'ea-visible-ui',
        observedAt,
        status: 'known',
        evidence: ['visible-pack-row-name'],
      },
      overall: {
        value: overall,
        source: 'ea-visible-ui',
        observedAt,
        status: 'known',
        evidence: ['visible-pack-card-rating'],
      },
      position: {
        value: position,
        source: 'ea-visible-ui',
        observedAt,
        status: 'known',
        evidence: ['visible-pack-card-position'],
      },
      club: unknownString(observedAt),
      league: unknownString(observedAt),
      nation: unknownString(observedAt),
      rarity: rarityObservation(card, observedAt),
      tradeability: {
        value: null,
        source: 'ea-visible-ui',
        observedAt,
        status: 'unknown',
        evidence: ['tradeability-not-exposed-for-every-pack-row'],
      },
      firstOwner: firstOwnerVisible
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
            evidence: ['no-visible-first-owner-marker'],
          },
      loan: {
        value: card.classList.contains('loan'),
        source: 'ea-visible-ui',
        observedAt,
        status: 'inferred',
        evidence: ['visible-pack-card-loan-class'],
      },
      faceStats: [],
    }),
  };
}

export function extractPackResultEvent(
  document: Document,
  options: ExtractPackResultOptions = {},
): NormalizedAdapterEvent {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const observedAt = (options.now ?? (() => new Date()))().toISOString();
  const classification = classifyScreen(document);
  if (classification.screen !== 'pack-result') {
    return createDegradedEvent(
      'unknown',
      ['unsupported-screen'],
      observedAt,
      createId,
    );
  }

  const views = document.querySelectorAll(VIEW_SELECTOR);
  if (views.length !== 1 || views[0] === undefined) {
    return createDegradedEvent(
      'pack-result',
      ['unassigned-view-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }

  const sections = Array.from(views[0].querySelectorAll(SECTION_SELECTOR));
  const classifiedSections = sections.map((section) => {
    const headings = section.querySelectorAll(SECTION_HEADING_SELECTOR);
    return {
      section,
      heading:
        headings.length === 1
          ? normalizeText(headings[0]?.textContent ?? null)
          : '',
    };
  });
  const itemSections = classifiedSections.filter(
    ({ heading }) => heading === 'Items',
  );
  const duplicateSections = classifiedSections.filter(
    ({ heading }) => heading === 'Duplicates',
  );
  if (
    itemSections.length !== 1 ||
    duplicateSections.length > 1 ||
    classifiedSections[0]?.heading !== 'Items' ||
    (classifiedSections.length === 2 &&
      classifiedSections[1]?.heading !== 'Duplicates') ||
    classifiedSections.some(
      ({ heading }) => heading !== 'Items' && heading !== 'Duplicates',
    )
  ) {
    return createDegradedEvent(
      'pack-result',
      ['pack-result-sections-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }

  const itemSection = itemSections[0];
  if (itemSection === undefined) {
    return createDegradedEvent(
      'pack-result',
      ['pack-result-sections-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }
  const orderedSections = [itemSection, ...duplicateSections];
  const cards: VisibleCard[] = [];
  const duplicateIndexes: number[] = [];
  const reasonCodes: string[] = [];
  for (const { section, heading } of orderedSections) {
    const rows = Array.from(section.querySelectorAll(ROW_SELECTOR));
    for (const row of rows) {
      const visibleIndex = cards.length;
      const extracted = cardFromRow(row, visibleIndex, observedAt, createId);
      if (extracted.card === null) {
        reasonCodes.push(...extracted.reasonCodes);
      } else {
        cards.push(extracted.card);
        if (heading === 'Duplicates') duplicateIndexes.push(visibleIndex);
      }
    }
  }
  if (reasonCodes.length > 0 || cards.length === 0) {
    return createDegradedEvent(
      'pack-result',
      reasonCodes.length > 0 ? reasonCodes : ['pack-result-empty'],
      observedAt,
      createId,
    );
  }

  return packResultVisibleEventSchema.parse({
    eventVersion: 1,
    eventId: createId(),
    type: 'packResult.visible',
    webAppBuild: unknownString(observedAt),
    occurredAt: observedAt,
    confidence: 0.95,
    extractionStatus: 'known',
    adapterVersion: ADAPTER_VERSION,
    payload: { cards, duplicateIndexes },
  });
}
