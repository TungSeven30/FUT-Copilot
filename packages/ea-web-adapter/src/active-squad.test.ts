import liveContractFixture from '../../../fixtures/ea-web/active-squad/live-contract.json';

import { extractActiveSquadEvent } from './active-squad';
import { classifyScreen } from './screen-classifier';
import { FixtureHarness } from './testing/fixture-harness';

const observedAt = '2026-08-01T18:00:00.000Z';

function createHarness() {
  return new FixtureHarness(liveContractFixture, () => []);
}

function extract(document: Document) {
  return extractActiveSquadEvent(document, {
    now: () => new Date(observedAt),
  });
}

describe('live active-squad contract', () => {
  it('classifies the sanitized live structure using independent anchors', () => {
    const harness = createHarness();
    harness.load();

    expect(classifyScreen(harness.fixtureDocument)).toEqual({
      screen: 'active-squad',
      confidence: 0.99,
      evidenceCodes: [
        'squad-actions-view-visible',
        'squad-overview-visible',
        'squad-pitch-visible',
        'bench-reserve-docks-visible',
      ],
    });
  });

  it('preserves starting, bench, and reserve order while excluding the manager', () => {
    const harness = createHarness();
    harness.load();
    const event = extract(harness.fixtureDocument);

    expect(event.type).toBe('activeSquad.visible');
    if (event.type !== 'activeSquad.visible') {
      throw new Error('Expected an activeSquad.visible event.');
    }

    expect(event.extractionStatus).toBe('inferred');
    expect(event.payload.slots).toHaveLength(23);
    expect(
      event.payload.slots.filter((slot) => slot.group === 'starting'),
    ).toHaveLength(11);
    expect(
      event.payload.slots.filter((slot) => slot.group === 'bench'),
    ).toHaveLength(7);
    expect(
      event.payload.slots.filter((slot) => slot.group === 'reserves'),
    ).toHaveLength(5);
    expect(event.payload.slots.map((slot) => slot.slot)).toEqual([
      ...Array.from({ length: 11 }, (_, index) => `START-${index + 1}`),
      ...Array.from({ length: 7 }, (_, index) => `SUB-${index + 1}`),
      ...Array.from({ length: 5 }, (_, index) => `RES-${index + 1}`),
    ]);
  });

  it('extracts only visible squad-card facts and keeps names unknown', () => {
    const harness = createHarness();
    harness.load();
    const event = extract(harness.fixtureDocument);
    if (event.type !== 'activeSquad.visible') {
      throw new Error('Expected an activeSquad.visible event.');
    }

    const starter = event.payload.slots[0]?.card;
    const substitute = event.payload.slots[11]?.card;
    const reserve = event.payload.slots[18]?.card;
    expect(starter).toMatchObject({
      name: { value: null, status: 'unknown' },
      overall: { value: 89, status: 'known' },
      position: { value: 'ST', status: 'known' },
      rarity: { value: 'rare', status: 'inferred' },
      firstOwner: { value: true, status: 'inferred' },
      loan: { value: false, status: 'inferred' },
    });
    expect(substitute).toMatchObject({
      overall: { value: 84 },
      position: { value: 'CM' },
    });
    expect(reserve).toMatchObject({
      overall: { value: 86 },
      position: { value: 'CB' },
      rarity: { value: 'special' },
      loan: { value: true },
    });
    expect(
      event.payload.slots.filter((slot) => slot.card === null),
    ).toHaveLength(20);
  });

  it('fails closed when the manager boundary becomes ambiguous', () => {
    const harness = createHarness();
    harness.load();
    harness.fixtureDocument
      .querySelector('.manager')
      ?.classList.remove('manager');

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('adapter.degraded');
    if (event.type === 'adapter.degraded') {
      expect(event.payload.screen).toBe('active-squad');
      expect(event.payload.reasonCodes).toContain(
        'starting-and-manager-slot-shape-mismatch',
      );
    }
  });

  it('fails closed when a loaded card loses a required visible field', () => {
    const harness = createHarness();
    harness.load();
    harness.fixtureDocument.querySelector('.rating')?.remove();

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('adapter.degraded');
    if (event.type === 'adapter.degraded') {
      expect(event.payload.reasonCodes).toEqual([
        'starting-1-missing-or-ambiguous-rating',
      ]);
    }
  });

  it('does not treat a partially loaded player as an empty slot', () => {
    const harness = createHarness();
    harness.load();
    const emptySlot = Array.from(
      harness.fixtureDocument.querySelectorAll('.ut-squad-slot-view'),
    ).find((slot) => slot.childElementCount === 0);
    emptySlot?.insertAdjacentHTML('beforeend', "<div class='player'></div>");

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('adapter.degraded');
    if (event.type === 'adapter.degraded') {
      expect(event.payload.reasonCodes).toEqual([
        'starting-2-player-not-loaded',
      ]);
    }
  });
});
