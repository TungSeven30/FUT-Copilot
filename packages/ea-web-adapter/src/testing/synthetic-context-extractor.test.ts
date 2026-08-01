import activeSquadFixture from '../../../../fixtures/ea-web/active-squad/basic.json';
import duplicateFixture from '../../../../fixtures/ea-web/duplicate/basic.json';
import marketFixture from '../../../../fixtures/ea-web/market/basic.json';
import packResultFixture from '../../../../fixtures/ea-web/pack-result/basic.json';
import playerPickFixture from '../../../../fixtures/ea-web/player-pick/basic.json';
import sbcFixture from '../../../../fixtures/ea-web/sbc/basic.json';
import { FixtureHarness } from './fixture-harness';
import { extractSyntheticContextEvent } from './synthetic-context-extractor';

const observedAt = '2026-08-01T15:00:00.000Z';
type WorkflowFixture =
  | typeof activeSquadFixture
  | typeof packResultFixture
  | typeof playerPickFixture
  | typeof duplicateFixture
  | typeof sbcFixture
  | typeof marketFixture;

function eventFor(fixture: WorkflowFixture) {
  const harness = new FixtureHarness(fixture, (document) => [
    extractSyntheticContextEvent(document, {
      createId: () => 'e89e176a-3cd9-467e-8f41-44ae42117877',
      now: () => new Date(observedAt),
    }),
  ]);
  return harness.load()[0];
}

describe('synthetic workflow fixtures', () => {
  it('keeps starting, bench, and reserve squad groups distinct', () => {
    const event = eventFor(activeSquadFixture);
    expect(event?.type).toBe('activeSquad.visible');
    if (event?.type === 'activeSquad.visible') {
      expect(event.payload.slots.map((slot) => slot.group)).toEqual([
        'starting',
        'bench',
        'reserves',
      ]);
    }
  });

  it('preserves displayed pack and player-pick order without selecting', () => {
    const pack = eventFor(packResultFixture);
    const pick = eventFor(playerPickFixture);
    if (
      pack?.type !== 'packResult.visible' ||
      pick?.type !== 'playerPick.visible'
    ) {
      throw new Error('Expected pack and player-pick events.');
    }
    expect(pack.payload.cards.map((card) => card.name.value)).toEqual([
      'Pack One',
      'Pack Two',
    ]);
    expect(pick.payload.options.map((card) => card.name.value)).toEqual([
      'Pick One',
      'Pick Two',
      'Pick Three',
    ]);
    expect(pick.payload.selectedIndex).toBeNull();
  });

  it('emits normalized duplicate, SBC, and market contexts', () => {
    expect(eventFor(duplicateFixture)?.type).toBe('duplicate.detected');
    const sbc = eventFor(sbcFixture);
    const market = eventFor(marketFixture);
    if (
      sbc?.type !== 'sbcContext.visible' ||
      market?.type !== 'marketContext.visible'
    ) {
      throw new Error('Expected SBC and market events.');
    }
    expect(sbc.payload.requirementLabels.map((value) => value.value)).toEqual([
      'Players: 11',
      'Team Overall Rating: Min. 84',
    ]);
    expect(market.payload.displayedPrices.map((value) => value.value)).toEqual([
      42_000, 43_500,
    ]);
  });
});
