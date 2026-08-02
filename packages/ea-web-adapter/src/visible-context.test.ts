import activeSquadFixture from '../../../fixtures/ea-web/active-squad/live-contract.json';
import livePackResultFixture from '../../../fixtures/ea-web/pack-result/live-unassigned-contract.json';
import livePopulatedSbcFixture from '../../../fixtures/ea-web/sbc/live-populated-card-contract.json';
import transferListFixture from '../../../fixtures/ea-web/market/live-transfer-list-contract.json';
import transferMarketFixture from '../../../fixtures/ea-web/market/live-search-results-contract.json';
import liveSbcFixture from '../../../fixtures/ea-web/sbc/live-requirements-contract.json';
import selectedCardFixture from '../../../fixtures/ea-web/selected-card/basic.json';

import { FixtureHarness } from './testing/fixture-harness';
import { extractVisibleContextEvent } from './visible-context';

describe('visible context dispatcher', () => {
  it('routes the live Unassigned contract to the pack-result extractor', () => {
    const harness = new FixtureHarness(livePackResultFixture, () => []);
    harness.load();

    expect(extractVisibleContextEvent(harness.fixtureDocument).type).toBe(
      'packResult.visible',
    );
  });

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

  it('routes the Transfer List contract to its live extractor', () => {
    const harness = new FixtureHarness(transferListFixture, () => []);
    harness.load();

    expect(extractVisibleContextEvent(harness.fixtureDocument).type).toBe(
      'marketContext.visible',
    );
  });

  it('routes the Transfer Market contract to its live extractor', () => {
    const harness = new FixtureHarness(transferMarketFixture, () => []);
    harness.load();

    expect(extractVisibleContextEvent(harness.fixtureDocument).type).toBe(
      'marketContext.visible',
    );
  });

  it('routes the live SBC contract to its requirements extractor', () => {
    const harness = new FixtureHarness(liveSbcFixture, () => []);
    harness.load();

    expect(extractVisibleContextEvent(harness.fixtureDocument).type).toBe(
      'sbcContext.visible',
    );
  });

  it('routes the populated SBC builder contract to its live extractor', () => {
    const harness = new FixtureHarness(livePopulatedSbcFixture, () => []);
    harness.load();

    expect(extractVisibleContextEvent(harness.fixtureDocument).type).toBe(
      'sbcContext.visible',
    );
  });
});
