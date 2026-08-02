import { classifyScreen } from './screen-classifier';

describe('classifyScreen', () => {
  it('does not classify a Transfer List heading without its view anchor', () => {
    const fixtureDocument = document.implementation.createHTMLDocument(
      'partial-transfer-list',
    );
    fixtureDocument.body.innerHTML =
      '<main class="ut-root-view"><h1 class="title">Transfer List</h1></main>';

    expect(classifyScreen(fixtureDocument)).toEqual({
      screen: 'unknown',
      confidence: 0,
      evidenceCodes: ['no-supported-screen-anchor'],
    });
  });

  it('does not classify a partial squad shell as a supported active squad', () => {
    const fixtureDocument =
      document.implementation.createHTMLDocument('partial-squad');
    fixtureDocument.body.innerHTML =
      '<main><section class="ut-squad-overview"><div class="ut-squad-pitch-view"></div></section></main>';

    expect(classifyScreen(fixtureDocument)).toEqual({
      screen: 'unknown',
      confidence: 0,
      evidenceCodes: ['no-supported-screen-anchor'],
    });
  });

  it('returns unknown rather than guessing an unsupported layout', () => {
    const fixtureDocument =
      document.implementation.createHTMLDocument('unsupported');
    fixtureDocument.body.innerHTML =
      '<main class="ut-root-view"><h1 class="title">Another screen</h1></main>';

    expect(classifyScreen(fixtureDocument)).toEqual({
      screen: 'unknown',
      confidence: 0,
      evidenceCodes: ['no-supported-screen-anchor'],
    });
  });
});
