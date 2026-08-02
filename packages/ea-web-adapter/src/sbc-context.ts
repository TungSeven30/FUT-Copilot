import {
  adapterDegradedEventSchema,
  sbcContextVisibleEventSchema,
  visibleCardSchema,
  type NormalizedAdapterEvent,
  type VisibleCard,
} from '@fut-copilot/domain/adapter-events';

import { ADAPTER_VERSION } from './adapter-version';
import { classifyScreen } from './screen-classifier';

const HEADING_SELECTOR = '.ut-root-view h1.title';
const REQUIREMENTS_SELECTOR = '.sbc-requirements-checklist';
const SLOT_SELECTOR = '.ut-squad-slot-view';
const PITCH_SELECTOR = '.ut-squad-pitch-view.sbc';
const DOCK_SELECTOR = '.ut-squad-slot-dock-view.sbc';
const LOADED_PLAYER_SELECTOR = '.player.ut-item-loaded';
const SBC_BUILDER_HEADING_SELECTOR =
  '.ut-root-view > .ut-tab-bar-view.game-navigation > .ut-navigation-container-view > .ut-navigation-bar-view.navbar-style-landscape h1.title';

type ExtractSbcContextOptions = {
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

function knownString(value: string, observedAt: string, evidence: string[]) {
  return {
    value,
    source: 'ea-visible-ui' as const,
    observedAt,
    status: 'known' as const,
    evidence,
  };
}

function rarityObservation(card: Element, observedAt: string) {
  const value = card.classList.contains('specials')
    ? 'special'
    : card.classList.contains('rare')
      ? 'rare'
      : null;
  return value === null
    ? unknownString(observedAt, ['unrecognized-sbc-card-rarity'])
    : {
        value,
        source: 'ea-visible-ui' as const,
        observedAt,
        status: 'inferred' as const,
        evidence: ['visible-sbc-card-rarity-class'],
      };
}

function cardFromSlot(
  slot: Element,
  group: 'pitch' | 'work-area',
  index: number,
  observedAt: string,
  createId: () => string,
): { card: VisibleCard | null; reasonCodes: string[] } {
  const slotCode = `${group}-${index + 1}`;
  const loadedPlayers = slot.querySelectorAll(LOADED_PLAYER_SELECTOR);
  if (loadedPlayers.length === 0) return { card: null, reasonCodes: [] };
  if (loadedPlayers.length !== 1) {
    return {
      card: null,
      reasonCodes: [`${slotCode}-player-anchor-ambiguous`],
    };
  }

  const card = loadedPlayers[0];
  if (card === undefined) {
    return {
      card: null,
      reasonCodes: [`${slotCode}-player-anchor-ambiguous`],
    };
  }
  if (card.classList.contains('concept')) {
    return {
      card: null,
      reasonCodes: [`${slotCode}-concept-card-not-owned`],
    };
  }

  const ratingAnchors = card.querySelectorAll('.rating');
  const positionAnchors = card.querySelectorAll('.position');
  const rating =
    ratingAnchors.length === 1
      ? parseRating(normalizeText(ratingAnchors[0]?.textContent ?? null))
      : null;
  const position =
    positionAnchors.length === 1
      ? normalizeText(positionAnchors[0]?.textContent ?? null)
      : '';
  const reasonCodes = [
    ...(rating === null ? [`${slotCode}-missing-or-ambiguous-rating`] : []),
    ...(position === '' ? [`${slotCode}-missing-or-ambiguous-position`] : []),
  ];
  if (reasonCodes.length > 0 || rating === null) {
    return { card: null, reasonCodes };
  }

  const firstOwnerMarker = card.querySelector('.icon_chemistry_first_owner');
  const firstOwnerVisible =
    firstOwnerMarker !== null && isVisible(firstOwnerMarker);

  return {
    reasonCodes: [],
    card: visibleCardSchema.parse({
      localObservationId: createId(),
      name: unknownString(observedAt, [
        'name-not-exposed-on-compact-sbc-card',
        'visible-pinned-row-not-provably-linked-to-sbc-slot',
      ]),
      overall: {
        value: rating,
        source: 'ea-visible-ui',
        observedAt,
        status: 'known',
        evidence: ['visible-sbc-card-rating'],
      },
      position: knownString(position, observedAt, [
        'visible-sbc-card-position',
      ]),
      club: unknownString(observedAt),
      league: unknownString(observedAt),
      nation: unknownString(observedAt),
      rarity: rarityObservation(card, observedAt),
      tradeability: {
        value: null,
        source: 'ea-visible-ui',
        observedAt,
        status: 'unknown',
        evidence: ['tradeability-not-exposed-on-live-sbc-card'],
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
        evidence: ['visible-sbc-card-loan-class'],
      },
      faceStats: [],
    }),
  };
}

function createDegradedEvent(
  screen: 'sbc' | 'unknown',
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

function equalLabels(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((label, index) => label === right[index])
  );
}

export function extractSbcContextEvent(
  document: Document,
  options: ExtractSbcContextOptions = {},
): NormalizedAdapterEvent {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const observedAt = (options.now ?? (() => new Date()))().toISOString();
  const classification = classifyScreen(document);
  if (classification.screen !== 'sbc') {
    return createDegradedEvent(
      'unknown',
      ['unsupported-screen'],
      observedAt,
      createId,
    );
  }

  const builderHeadings = document.querySelectorAll(
    SBC_BUILDER_HEADING_SELECTOR,
  );
  const headings = document.querySelectorAll(HEADING_SELECTOR);
  const headingCandidates = classification.evidenceCodes.includes(
    'sbc-builder-heading-visible',
  )
    ? builderHeadings
    : headings;
  const challengeName = normalizeText(
    headingCandidates[0]?.textContent ?? null,
  );
  if (headingCandidates.length !== 1 || challengeName === '') {
    return createDegradedEvent(
      'sbc',
      ['challenge-heading-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }

  const requirementLists = Array.from(
    document.querySelectorAll(REQUIREMENTS_SELECTOR),
  ).map((list) =>
    Array.from(list.querySelectorAll('li')).map((item) =>
      normalizeText(item.textContent),
    ),
  );
  const builderLayout = classification.evidenceCodes.includes(
    'sbc-builder-heading-visible',
  );
  if (
    requirementLists.length !== (builderLayout ? 1 : 2) ||
    requirementLists.some(
      (labels) => labels.length === 0 || labels.some((label) => label === ''),
    )
  ) {
    return createDegradedEvent(
      'sbc',
      ['requirement-checklists-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }
  const requirementLabels = requirementLists[0];
  const mirroredRequirementLabels = requirementLists[1];
  if (requirementLabels === undefined) {
    return createDegradedEvent(
      'sbc',
      ['requirement-checklists-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }
  if (
    mirroredRequirementLabels !== undefined &&
    !equalLabels(requirementLabels, mirroredRequirementLabels)
  ) {
    return createDegradedEvent(
      'sbc',
      ['requirement-checklists-disagree'],
      observedAt,
      createId,
    );
  }

  const pitch = document.querySelector(PITCH_SELECTOR);
  const dock = document.querySelector(DOCK_SELECTOR);
  if (pitch === null || dock === null) {
    return createDegradedEvent(
      'sbc',
      ['sbc-squad-anchor-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }
  const pitchSlots = Array.from(pitch.querySelectorAll(SLOT_SELECTOR));
  const dockSlots = Array.from(dock.querySelectorAll(SLOT_SELECTOR));
  if (pitchSlots.length !== 11 || dockSlots.length !== 12) {
    return createDegradedEvent(
      'sbc',
      ['sbc-slot-shape-mismatch'],
      observedAt,
      createId,
    );
  }

  const slots = [...pitchSlots, ...dockSlots];
  if (slots.some((slot) => slot.querySelectorAll('.player').length !== 1)) {
    return createDegradedEvent(
      'sbc',
      ['sbc-empty-card-shape-mismatch'],
      observedAt,
      createId,
    );
  }
  const parsedCards = [
    ...pitchSlots.map((slot, index) =>
      cardFromSlot(slot, 'pitch', index, observedAt, createId),
    ),
    ...dockSlots.map((slot, index) =>
      cardFromSlot(slot, 'work-area', index, observedAt, createId),
    ),
  ];
  const cardReasonCodes = parsedCards.flatMap((result) => result.reasonCodes);
  if (cardReasonCodes.length > 0) {
    return createDegradedEvent('sbc', cardReasonCodes, observedAt, createId);
  }
  const cards = parsedCards.flatMap((result) =>
    result.card === null ? [] : [result.card],
  );

  return sbcContextVisibleEventSchema.parse({
    eventVersion: 1,
    eventId: createId(),
    type: 'sbcContext.visible',
    webAppBuild: unknownString(observedAt),
    occurredAt: observedAt,
    confidence: cards.length === 0 ? 0.94 : 0.91,
    extractionStatus: 'inferred',
    adapterVersion: ADAPTER_VERSION,
    payload: {
      challengeName: knownString(challengeName, observedAt, [
        'visible-sbc-challenge-heading',
      ]),
      segmentName: unknownString(observedAt, [
        'segment-name-not-distinctly-exposed-on-live-single-segment-sbc',
      ]),
      requirementLabels: requirementLabels.map((label) =>
        knownString(label, observedAt, [
          requirementLists.length === 2
            ? 'matching-visible-sbc-requirement-checklists'
            : 'single-visible-sbc-builder-requirement-checklist',
        ]),
      ),
      cards,
    },
  });
}
