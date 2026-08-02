import type { NormalizedAdapterEvent } from '@fut-copilot/domain/adapter-events';

import selectedCardFixture from '../../../../fixtures/ea-web/selected-card/basic.json';
import { createAdapterEventSignature } from '../event-signature';
import { classifyScreen } from '../screen-classifier';
import { extractSelectedCardEvent } from '../selected-card';
import { FixtureHarness } from './fixture-harness';

const observedAt = '2026-08-01T15:00:00.000Z';
const ids = [
  'b3ef63a8-e08d-4246-a36e-468effd095c2',
  '651d458f-dbe0-4792-8fc1-2baf53a50414',
  '9368de5e-9a92-4054-94b1-09875059e151',
  '3ad92f11-e0aa-44ec-b18f-7842dde5409f',
  'dc796ea3-f6ae-441e-b231-e3180d68e6fb',
];

function createIdFactory() {
  let index = 0;
  return () => ids[index++] ?? crypto.randomUUID();
}

function createHarness() {
  const createId = createIdFactory();
  return new FixtureHarness<NormalizedAdapterEvent>(
    selectedCardFixture,
    (document) => [
      extractSelectedCardEvent(document, {
        createId,
        now: () => new Date(observedAt),
      }),
    ],
  );
}

describe('selected-card fixture vertical slice', () => {
  it('classifies the Club screen before a card is selected', () => {
    const harness = createHarness();
    harness.load();

    expect(classifyScreen(harness.fixtureDocument)).toEqual({
      screen: 'club',
      confidence: 0.98,
      evidenceCodes: ['club-heading-visible'],
    });
  });

  it('loads the fixture, applies selection, and emits a normalized card', () => {
    const harness = createHarness();
    const initialEvents = harness.load();
    const initial = initialEvents[0];

    expect(initial?.type).toBe('card.selected');
    if (initial?.type !== 'card.selected') {
      throw new Error('Expected a card.selected event.');
    }
    expect(initial.payload.card).toBeNull();

    const emitted = harness.advanceTo(100);
    const selected = emitted[0];
    expect(selected?.type).toBe('card.selected');
    if (selected?.type !== 'card.selected') {
      throw new Error('Expected a selected-card event after the mutation.');
    }

    expect(selected.payload.card?.name.value).toBe('Alex Example');
    expect(selected.payload.card?.overall.value).toBe(91);
    expect(selected.payload.card?.position.value).toBe('ST');
    expect(selected.payload.card?.tradeability).toMatchObject({
      value: 'tradeable',
      status: 'inferred',
    });
    expect(selected.payload.card?.firstOwner).toMatchObject({
      value: true,
      status: 'inferred',
    });
    expect(selected.payload.card?.club.status).toBe('unknown');
    expect(selected.payload.card?.faceStats).toEqual([
      { label: 'PAC', value: 92 },
      { label: 'SHO', value: 91 },
      { label: 'PAS', value: 86 },
      { label: 'DRI', value: 93 },
      { label: 'DEF', value: 44 },
      { label: 'PHY', value: 88 },
    ]);
  });

  it('deduplicates observations using normalized facts, not event IDs', () => {
    const harness = createHarness();
    harness.load();
    const event = harness.advanceTo(100)[0];
    if (event === undefined) {
      throw new Error('Expected a selected-card event.');
    }
    const repeated = extractSelectedCardEvent(harness.fixtureDocument, {
      createId: createIdFactory(),
      now: () => new Date('2026-08-01T15:01:00.000Z'),
    });

    expect(createAdapterEventSignature(repeated)).toBe(
      createAdapterEventSignature(event),
    );
  });

  it('degrades safely when an incomplete card loses a required visible field', () => {
    const harness = createHarness();
    harness.load();
    harness.advanceTo(100);
    harness.fixtureDocument.querySelector('.name.main-view')?.remove();

    const event = extractSelectedCardEvent(harness.fixtureDocument, {
      createId: createIdFactory(),
      now: () => new Date(observedAt),
    });

    expect(event.type).toBe('adapter.degraded');
    if (event.type === 'adapter.degraded') {
      expect(event.payload.reasonCodes).toEqual(['missing-name']);
    }
  });

  it('infers a visible loan marker without guessing loan duration', () => {
    const harness = createHarness();
    harness.load();
    harness.advanceTo(100);
    harness.fixtureDocument
      .querySelector('.item.player.ut-item-loaded')
      ?.classList.add('loan');

    const event = extractSelectedCardEvent(harness.fixtureDocument, {
      createId: createIdFactory(),
      now: () => new Date(observedAt),
    });

    expect(event.type).toBe('card.selected');
    if (event.type === 'card.selected') {
      expect(event.payload.card?.loan).toMatchObject({
        value: true,
        status: 'inferred',
      });
    }
  });

  it('fails closed for a synthetic concept-card marker', () => {
    const harness = createHarness();
    harness.load();
    harness.advanceTo(100);
    harness.fixtureDocument
      .querySelector('.item.player.ut-item-loaded')
      ?.classList.add('concept');

    const event = extractSelectedCardEvent(harness.fixtureDocument, {
      createId: createIdFactory(),
      now: () => new Date(observedAt),
    });

    expect(event.type).toBe('adapter.degraded');
    if (event.type === 'adapter.degraded') {
      expect(event.payload.reasonCodes).toEqual(['concept-card-not-owned']);
    }
  });

  it('keeps an unrecognized synthetic Evolution rarity unknown', () => {
    const harness = createHarness();
    harness.load();
    harness.advanceTo(100);
    const card = harness.fixtureDocument.querySelector(
      '.item.player.ut-item-loaded',
    );
    card?.classList.remove('specials', 'rare');
    card?.classList.add('evolution');

    const event = extractSelectedCardEvent(harness.fixtureDocument, {
      createId: createIdFactory(),
      now: () => new Date(observedAt),
    });

    expect(event.type).toBe('card.selected');
    if (event.type === 'card.selected') {
      expect(event.payload.card?.rarity).toMatchObject({
        value: null,
        status: 'unknown',
      });
    }
  });

  it('degrades when more than one active card matches', () => {
    const harness = createHarness();
    harness.load();
    harness.advanceTo(100);
    const activeSlide = harness.fixtureDocument.querySelector(
      '.detail-carousel .tns-slide-active',
    );
    const card = activeSlide?.querySelector('.item.player.ut-item-loaded');
    if (activeSlide === null || card === null || card === undefined) {
      throw new Error('Expected synthetic active card.');
    }
    activeSlide.append(card.cloneNode(true));

    const event = extractSelectedCardEvent(harness.fixtureDocument, {
      createId: createIdFactory(),
      now: () => new Date(observedAt),
    });

    expect(event.type).toBe('adapter.degraded');
    if (event.type === 'adapter.degraded') {
      expect(event.payload.reasonCodes).toEqual([
        'active-card-anchor-missing-or-ambiguous',
      ]);
    }
  });
});
