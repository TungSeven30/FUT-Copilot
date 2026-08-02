import liveSbcFixture from '../../../fixtures/ea-web/sbc/live-requirements-contract.json';
import livePopulatedSbcFixture from '../../../fixtures/ea-web/sbc/live-populated-card-contract.json';

import { classifyScreen } from './screen-classifier';
import { extractSbcContextEvent } from './sbc-context';
import { FixtureHarness } from './testing/fixture-harness';

const observedAt = '2026-08-01T21:00:00.000Z';

function createHarness() {
  const harness = new FixtureHarness(liveSbcFixture, () => []);
  harness.load();
  return harness;
}

function createPopulatedHarness() {
  const harness = new FixtureHarness(livePopulatedSbcFixture, () => []);
  harness.load();
  return harness;
}

function extract(document: Document) {
  return extractSbcContextEvent(document, {
    now: () => new Date(observedAt),
  });
}

describe('live SBC requirements contract', () => {
  it('classifies one English SBC challenge layout', () => {
    expect(classifyScreen(createHarness().fixtureDocument)).toEqual({
      screen: 'sbc',
      confidence: 0.99,
      evidenceCodes: [
        'sbc-challenge-heading-visible',
        'sbc-challenge-panel-visible',
        'sbc-details-view-visible',
        'sbc-pitch-visible',
        'sbc-work-area-visible',
      ],
    });
  });

  it('deduplicates matching requirement checklists in visible order', () => {
    const event = extract(createHarness().fixtureDocument);

    expect(event.type).toBe('sbcContext.visible');
    if (event.type !== 'sbcContext.visible') {
      throw new Error('Expected an sbcContext.visible event.');
    }
    expect(event.payload.challengeName).toMatchObject({
      value: 'Daily Login Example',
      status: 'known',
    });
    expect(event.payload.segmentName).toMatchObject({
      value: null,
      status: 'unknown',
    });
    expect(event.payload.requirementLabels.map((label) => label.value)).toEqual(
      ['Player Quality: Exactly Bronze', 'Number of Players in the Squad: 1'],
    );
    expect(event.payload.cards).toEqual([]);
  });

  it('fails closed when the mirrored requirement lists disagree', () => {
    const harness = createHarness();
    const lists = harness.fixtureDocument.querySelectorAll(
      '.sbc-requirements-checklist',
    );
    lists[1]?.querySelector('li')?.replaceChildren('Players: Exactly 2');

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('adapter.degraded');
    if (event.type === 'adapter.degraded') {
      expect(event.payload.reasonCodes).toEqual([
        'requirement-checklists-disagree',
      ]);
    }
  });

  it('classifies the live populated SBC builder layout', () => {
    expect(classifyScreen(createPopulatedHarness().fixtureDocument)).toEqual({
      screen: 'sbc',
      confidence: 0.99,
      evidenceCodes: [
        'sbc-builder-heading-visible',
        'sbc-overview-visible',
        'sbc-pitch-visible',
        'sbc-work-area-visible',
        'sbc-requirements-visible',
        'sbc-item-search-visible',
      ],
    });
  });

  it('extracts visible slot facts while keeping the unlinked identity unknown', () => {
    const event = extract(createPopulatedHarness().fixtureDocument);

    expect(event.type).toBe('sbcContext.visible');
    if (event.type !== 'sbcContext.visible') {
      throw new Error('Expected an sbcContext.visible event.');
    }
    expect(event.payload.challengeName.value).toBe('Builder Example');
    expect(event.payload.requirementLabels.map((label) => label.value)).toEqual(
      [
        'Player Quality: Exactly Gold',
        'Team Overall Rating: Min. 81',
        'Number of Players in the Squad: 11',
      ],
    );
    expect(event.payload.cards).toHaveLength(1);
    expect(event.payload.cards[0]).toMatchObject({
      name: {
        value: null,
        status: 'unknown',
        evidence: [
          'name-not-exposed-on-compact-sbc-card',
          'visible-pinned-row-not-provably-linked-to-sbc-slot',
        ],
      },
      overall: { value: 82, status: 'known' },
      position: { value: 'CM', status: 'known' },
      rarity: { value: null, status: 'unknown' },
      loan: { value: false, status: 'inferred' },
    });
  });

  it('preserves pitch then work-area card order and keeps unselected names unknown', () => {
    const harness = createPopulatedHarness();
    const dockSlot = harness.fixtureDocument.querySelector(
      '.ut-squad-slot-dock-view.sbc .ut-squad-slot-view',
    );
    dockSlot?.replaceChildren();
    dockSlot?.insertAdjacentHTML(
      'beforeend',
      "<div class='small player item rare ut-item-loaded'><span class='rating'>81</span><span class='position'>CB</span></div>",
    );

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('sbcContext.visible');
    if (event.type !== 'sbcContext.visible') {
      throw new Error('Expected an sbcContext.visible event.');
    }
    expect(
      event.payload.cards.map((card) => ({
        name: card.name.value,
        overall: card.overall.value,
        position: card.position.value,
      })),
    ).toEqual([
      { name: null, overall: 82, position: 'CM' },
      { name: null, overall: 81, position: 'CB' },
    ]);
  });

  it('does not attach a visible pinned-row name to the SBC slot', () => {
    const harness = createPopulatedHarness();
    harness.fixtureDocument.querySelector(
      '.ut-pinned-item .name',
    )!.textContent = 'Different Visible Example';

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('sbcContext.visible');
    if (event.type !== 'sbcContext.visible') {
      throw new Error('Expected an sbcContext.visible event.');
    }
    expect(event.payload.cards[0]?.name).toMatchObject({
      value: null,
      status: 'unknown',
      evidence: [
        'name-not-exposed-on-compact-sbc-card',
        'visible-pinned-row-not-provably-linked-to-sbc-slot',
      ],
    });
  });

  it('fails closed when a populated slot has no unambiguous rating', () => {
    const harness = createPopulatedHarness();
    harness.fixtureDocument
      .querySelector('.ut-squad-pitch-view.sbc .player.ut-item-loaded .rating')
      ?.remove();

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('adapter.degraded');
    if (event.type === 'adapter.degraded') {
      expect(event.payload.reasonCodes).toEqual([
        'pitch-11-missing-or-ambiguous-rating',
      ]);
    }
  });

  it('fails closed when the 11 plus 12 slot shape changes', () => {
    const harness = createHarness();
    harness.fixtureDocument
      .querySelector('.ut-squad-slot-dock-view.sbc .ut-squad-slot-view')
      ?.remove();

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('adapter.degraded');
    if (event.type === 'adapter.degraded') {
      expect(event.payload.reasonCodes).toEqual(['sbc-slot-shape-mismatch']);
    }
  });
});
