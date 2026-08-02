import {
  activeSquadVisibleEventSchema,
  adapterDegradedEventSchema,
  duplicateDetectedEventSchema,
  marketContextVisibleEventSchema,
  packResultVisibleEventSchema,
  playerPickVisibleEventSchema,
  sbcContextVisibleEventSchema,
  visibleCardSchema,
  type NormalizedAdapterEvent,
  type VisibleCard,
} from '@fut-copilot/domain/adapter-events';

type SyntheticOptions = {
  createId?: () => string;
  now?: () => Date;
};

function textObservation(value: string | null, observedAt: string) {
  return value === null || value.trim() === ''
    ? {
        value: null,
        source: 'fixture' as const,
        observedAt,
        status: 'unknown' as const,
      }
    : {
        value: value.trim(),
        source: 'fixture' as const,
        observedAt,
        status: 'known' as const,
      };
}

function unknownString(observedAt: string) {
  return textObservation(null, observedAt);
}

function cardFromElement(element: Element, observedAt: string): VisibleCard {
  const rating = Number.parseInt(element.getAttribute('data-rating') ?? '', 10);
  const tradeability = element.getAttribute('data-tradeability');
  return visibleCardSchema.parse({
    localObservationId: element.getAttribute('data-id'),
    name: textObservation(element.getAttribute('data-name'), observedAt),
    overall: {
      value: rating,
      source: 'fixture',
      observedAt,
      status: 'known',
    },
    position: textObservation(
      element.getAttribute('data-position'),
      observedAt,
    ),
    club: unknownString(observedAt),
    league: unknownString(observedAt),
    nation: unknownString(observedAt),
    rarity: textObservation(element.getAttribute('data-rarity'), observedAt),
    tradeability:
      tradeability === null || tradeability === 'unknown'
        ? {
            value: null,
            source: 'fixture',
            observedAt,
            status: 'unknown',
          }
        : {
            value: tradeability,
            source: 'fixture',
            observedAt,
            status: 'known',
          },
    firstOwner: {
      value: null,
      source: 'fixture',
      observedAt,
      status: 'unknown',
    },
    loan: {
      value: element.getAttribute('data-loan') === 'true',
      source: 'fixture',
      observedAt,
      status: 'known',
    },
    faceStats: [],
  });
}

function cardsFrom(root: ParentNode, observedAt: string): VisibleCard[] {
  return Array.from(root.querySelectorAll('[data-card]')).map((element) =>
    cardFromElement(element, observedAt),
  );
}

export function extractSyntheticContextEvent(
  document: Document,
  options: SyntheticOptions = {},
): NormalizedAdapterEvent {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const observedAt = (options.now ?? (() => new Date()))().toISOString();
  const root = document.querySelector('[data-fixture-screen]');
  const screen = root?.getAttribute('data-fixture-screen');
  const base = {
    eventVersion: 1 as const,
    eventId: createId(),
    webAppBuild: unknownString(observedAt),
    occurredAt: observedAt,
    confidence: 1,
    extractionStatus: 'known' as const,
    adapterVersion: 'synthetic-fixture-v1',
  };

  if (root === null) {
    return adapterDegradedEventSchema.parse({
      ...base,
      type: 'adapter.degraded',
      extractionStatus: 'unknown',
      payload: { screen: 'unknown', reasonCodes: ['fixture-screen-missing'] },
    });
  }

  if (screen === 'active-squad') {
    const slots = Array.from(root.querySelectorAll('[data-group]')).flatMap(
      (groupElement) => {
        const group = groupElement.getAttribute('data-group');
        return Array.from(groupElement.querySelectorAll('[data-card]')).map(
          (element) => ({
            slot: element.getAttribute('data-slot'),
            group,
            card: cardFromElement(element, observedAt),
          }),
        );
      },
    );
    return activeSquadVisibleEventSchema.parse({
      ...base,
      type: 'activeSquad.visible',
      payload: { slots },
    });
  }

  if (screen === 'pack-result') {
    return packResultVisibleEventSchema.parse({
      ...base,
      type: 'packResult.visible',
      payload: { cards: cardsFrom(root, observedAt) },
    });
  }

  if (screen === 'player-pick') {
    const selectedIndexValue = root.getAttribute('data-selected-index');
    return playerPickVisibleEventSchema.parse({
      ...base,
      type: 'playerPick.visible',
      payload: {
        options: cardsFrom(root, observedAt),
        selectedIndex:
          selectedIndexValue === null || selectedIndexValue === ''
            ? null
            : Number.parseInt(selectedIndexValue, 10),
      },
    });
  }

  if (screen === 'duplicate') {
    const duplicate = root.querySelector('[data-card][data-role="duplicate"]');
    const existing = root.querySelector('[data-card][data-role="existing"]');
    if (duplicate === null) {
      return adapterDegradedEventSchema.parse({
        ...base,
        type: 'adapter.degraded',
        extractionStatus: 'unknown',
        payload: {
          screen: 'duplicate',
          reasonCodes: ['duplicate-card-missing'],
        },
      });
    }
    return duplicateDetectedEventSchema.parse({
      ...base,
      type: 'duplicate.detected',
      payload: {
        duplicate: cardFromElement(duplicate, observedAt),
        existingCard:
          existing === null ? null : cardFromElement(existing, observedAt),
      },
    });
  }

  if (screen === 'sbc') {
    const requirements = Array.from(root.querySelectorAll('[data-requirement]'))
      .map((element) =>
        textObservation(element.getAttribute('data-requirement'), observedAt),
      )
      .filter((observation) => observation.value !== null);
    return sbcContextVisibleEventSchema.parse({
      ...base,
      type: 'sbcContext.visible',
      payload: {
        challengeName: textObservation(
          root.getAttribute('data-challenge'),
          observedAt,
        ),
        segmentName: textObservation(
          root.getAttribute('data-segment-name'),
          observedAt,
        ),
        requirementLabels: requirements,
        cards: cardsFrom(
          root.querySelector('[data-segment]') ?? root,
          observedAt,
        ),
      },
    });
  }

  if (screen === 'market') {
    const selected = root.querySelector('[data-card][data-role="selected"]');
    const displayedPrices = Array.from(
      root.querySelectorAll('[data-price]'),
    ).map((element) => ({
      value: Number.parseInt(element.getAttribute('data-price') ?? '', 10),
      source: 'fixture' as const,
      observedAt,
      status: 'known' as const,
    }));
    return marketContextVisibleEventSchema.parse({
      ...base,
      type: 'marketContext.visible',
      payload: {
        selectedCard:
          selected === null ? null : cardFromElement(selected, observedAt),
        displayedPrices,
      },
    });
  }

  return adapterDegradedEventSchema.parse({
    ...base,
    type: 'adapter.degraded',
    extractionStatus: 'unknown',
    payload: { screen: 'unknown', reasonCodes: ['unsupported-fixture-screen'] },
  });
}
