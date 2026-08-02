import {
  activeSquadVisibleEventSchema,
  adapterDegradedEventSchema,
  visibleCardSchema,
  type NormalizedAdapterEvent,
  type VisibleCard,
} from '@fut-copilot/domain/adapter-events';

import { ADAPTER_VERSION } from './adapter-version';
import { classifyScreen } from './screen-classifier';

const PITCH_SELECTOR = '.ut-squad-pitch-view';
const DOCK_SELECTOR = '.ut-squad-slot-dock-view--slot-container';
const SLOT_SELECTOR = '.ut-squad-slot-view';
const LOADED_PLAYER_SELECTOR = '.player.ut-item-loaded';

type ExtractActiveSquadOptions = {
  createId?: () => string;
  now?: () => Date;
};

type SquadGroup = 'starting' | 'bench' | 'reserves';

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
  screen: 'active-squad' | 'unknown',
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
  const value = card.classList.contains('specials')
    ? 'special'
    : card.classList.contains('rare')
      ? 'rare'
      : null;
  return value === null
    ? unknownString(observedAt, ['unrecognized-squad-card-rarity'])
    : {
        value,
        source: 'ea-visible-ui' as const,
        observedAt,
        status: 'inferred' as const,
        evidence: ['visible-squad-card-rarity-class'],
      };
}

function cardFromSlot(
  slot: Element,
  group: SquadGroup,
  index: number,
  observedAt: string,
  createId: () => string,
): { card: VisibleCard | null; reasonCodes: string[] } {
  const slotCode = `${group}-${index + 1}`;
  const loadedPlayers = slot.querySelectorAll(LOADED_PLAYER_SELECTOR);
  if (loadedPlayers.length === 0) {
    return slot.querySelector('.player') === null
      ? { card: null, reasonCodes: [] }
      : {
          card: null,
          reasonCodes: [`${slotCode}-player-not-loaded`],
        };
  }
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
  if (reasonCodes.length > 0) return { card: null, reasonCodes };

  const firstOwnerMarker = card.querySelector('.icon_chemistry_first_owner');
  const firstOwnerVisible =
    firstOwnerMarker !== null && isVisible(firstOwnerMarker);

  return {
    reasonCodes: [],
    card: visibleCardSchema.parse({
      localObservationId: createId(),
      name: unknownString(observedAt, ['name-not-exposed-on-live-squad-card']),
      overall: {
        value: rating,
        source: 'ea-visible-ui',
        observedAt,
        status: 'known',
        evidence: ['visible-squad-card-rating'],
      },
      position: {
        value: position,
        source: 'ea-visible-ui',
        observedAt,
        status: 'known',
        evidence: ['visible-squad-card-position'],
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
        evidence: ['tradeability-not-exposed-on-live-squad-card'],
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
        evidence: ['visible-squad-card-loan-class'],
      },
      faceStats: [],
    }),
  };
}

export function extractActiveSquadEvent(
  document: Document,
  options: ExtractActiveSquadOptions = {},
): NormalizedAdapterEvent {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const observedAt = (options.now ?? (() => new Date()))().toISOString();
  const classification = classifyScreen(document);
  if (classification.screen !== 'active-squad') {
    return createDegradedEvent(
      'unknown',
      ['unsupported-screen'],
      observedAt,
      createId,
    );
  }

  const pitch = document.querySelector(PITCH_SELECTOR);
  const docks = Array.from(document.querySelectorAll(DOCK_SELECTOR));
  if (pitch === null || docks.length !== 2) {
    return createDegradedEvent(
      'active-squad',
      ['squad-group-anchor-missing-or-ambiguous'],
      observedAt,
      createId,
    );
  }

  const pitchSlots = Array.from(pitch.querySelectorAll(SLOT_SELECTOR));
  const managerSlots = pitchSlots.filter(
    (slot) => slot.querySelector('.manager') !== null,
  );
  const startingSlots = pitchSlots.filter(
    (slot) => slot.querySelector('.manager') === null,
  );
  const benchSlots = Array.from(
    docks[0]?.querySelectorAll(SLOT_SELECTOR) ?? [],
  );
  const reserveSlots = Array.from(
    docks[1]?.querySelectorAll(SLOT_SELECTOR) ?? [],
  );
  const shapeReasons = [
    ...(pitchSlots.length !== 12 ||
    managerSlots.length !== 1 ||
    startingSlots.length !== 11
      ? ['starting-and-manager-slot-shape-mismatch']
      : []),
    ...(benchSlots.length !== 7 ? ['bench-slot-shape-mismatch'] : []),
    ...(reserveSlots.length !== 5 ? ['reserve-slot-shape-mismatch'] : []),
  ];
  if (shapeReasons.length > 0) {
    return createDegradedEvent(
      'active-squad',
      shapeReasons,
      observedAt,
      createId,
    );
  }

  const groups: Array<{ group: SquadGroup; slots: Element[] }> = [
    { group: 'starting', slots: startingSlots },
    { group: 'bench', slots: benchSlots },
    { group: 'reserves', slots: reserveSlots },
  ];
  const parsed = groups.flatMap(({ group, slots }) =>
    slots.map((slot, index) => ({
      group,
      index,
      result: cardFromSlot(slot, group, index, observedAt, createId),
    })),
  );
  const reasonCodes = parsed.flatMap(({ result }) => result.reasonCodes);
  if (reasonCodes.length > 0) {
    return createDegradedEvent(
      'active-squad',
      reasonCodes,
      observedAt,
      createId,
    );
  }

  return activeSquadVisibleEventSchema.parse({
    eventVersion: 1,
    eventId: createId(),
    type: 'activeSquad.visible',
    webAppBuild: unknownString(observedAt),
    occurredAt: observedAt,
    confidence: 0.9,
    extractionStatus: 'inferred',
    adapterVersion: ADAPTER_VERSION,
    payload: {
      slots: parsed.map(({ group, index, result }) => ({
        slot:
          group === 'starting'
            ? `START-${index + 1}`
            : group === 'bench'
              ? `SUB-${index + 1}`
              : `RES-${index + 1}`,
        group,
        card: result.card,
      })),
    },
  });
}
