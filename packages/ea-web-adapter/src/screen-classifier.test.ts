import { classifyScreen } from './screen-classifier';

describe('classifyScreen', () => {
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
