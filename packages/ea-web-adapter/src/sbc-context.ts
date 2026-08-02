import {
  adapterDegradedEventSchema,
  sbcContextVisibleEventSchema,
  type NormalizedAdapterEvent,
} from '@fut-copilot/domain/adapter-events';

import { ADAPTER_VERSION } from './adapter-version';
import { classifyScreen } from './screen-classifier';

const HEADING_SELECTOR = '.ut-root-view h1.title';
const REQUIREMENTS_SELECTOR = '.sbc-requirements-checklist';
const SLOT_SELECTOR = '.ut-squad-slot-view';
const PITCH_SELECTOR = '.ut-squad-pitch-view.sbc';
const DOCK_SELECTOR = '.ut-squad-slot-dock-view.sbc';
const LOADED_PLAYER_SELECTOR = '.player.ut-item-loaded';

type ExtractSbcContextOptions = {
  createId?: () => string;
  now?: () => Date;
};

function normalizeText(value: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
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

  const headings = document.querySelectorAll(HEADING_SELECTOR);
  const challengeName = normalizeText(headings[0]?.textContent ?? null);
  if (headings.length !== 1 || challengeName === '') {
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
  if (
    requirementLists.length !== 2 ||
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
  if (
    requirementLabels === undefined ||
    mirroredRequirementLabels === undefined ||
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
  if (
    slots.some((slot) => slot.querySelector(LOADED_PLAYER_SELECTOR) !== null)
  ) {
    return createDegradedEvent(
      'sbc',
      ['populated-sbc-squad-not-live-validated'],
      observedAt,
      createId,
    );
  }

  return sbcContextVisibleEventSchema.parse({
    eventVersion: 1,
    eventId: createId(),
    type: 'sbcContext.visible',
    webAppBuild: unknownString(observedAt),
    occurredAt: observedAt,
    confidence: 0.94,
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
          'matching-visible-sbc-requirement-checklists',
        ]),
      ),
      cards: [],
    },
  });
}
