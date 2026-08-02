import activeSquadFixture from '../../../fixtures/ea-web/active-squad/live-contract.json';
import selectedCardFixture from '../../../fixtures/ea-web/selected-card/basic.json';

import { FixtureHarness } from './testing/fixture-harness';
import { extractVisibleContextEvent } from './visible-context';

describe('visible context dispatcher', () => {
  it('routes the active-squad contract to its live extractor', () => {
    const harness = new FixtureHarness(activeSquadFixture, () => []);
    harness.load();

    expect(extractVisibleContextEvent(harness.fixtureDocument).type).toBe(
      'activeSquad.visible',
    );
  });

  it('keeps the supported Club selected-card path intact', () => {
    const harness = new FixtureHarness(selectedCardFixture, () => []);
    harness.load();
    harness.advanceTo(100);

    expect(extractVisibleContextEvent(harness.fixtureDocument).type).toBe(
      'card.selected',
    );
  });
});
