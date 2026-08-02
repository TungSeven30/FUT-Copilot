import liveSbcFixture from '../../../fixtures/ea-web/sbc/live-requirements-contract.json';

import { classifyScreen } from './screen-classifier';
import { extractSbcContextEvent } from './sbc-context';
import { FixtureHarness } from './testing/fixture-harness';

const observedAt = '2026-08-01T21:00:00.000Z';

function createHarness() {
  const harness = new FixtureHarness(liveSbcFixture, () => []);
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

  it('fails closed when a player card is populated', () => {
    const harness = createHarness();
    harness.fixtureDocument
      .querySelector('.ut-squad-pitch-view.sbc .player')
      ?.classList.add('ut-item-loaded');

    const event = extract(harness.fixtureDocument);
    expect(event.type).toBe('adapter.degraded');
    if (event.type === 'adapter.degraded') {
      expect(event.payload.reasonCodes).toEqual([
        'populated-sbc-squad-not-live-validated',
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
