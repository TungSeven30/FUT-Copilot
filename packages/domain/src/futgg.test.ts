import { createFutggResearchLink } from './futgg';

describe('FUT.GG research links', () => {
  it('uses a name-filtered public search for a composite identity', () => {
    expect(
      createFutggResearchLink({
        playerName: 'Alex Example',
        identityConfidence: 0.81,
      }),
    ).toEqual({
      mode: 'search',
      url: 'https://www.fut.gg/players/?name=Alex+Example',
      label: 'Search FUT.GG for Alex Example',
    });
  });

  it('uses only a confirmed exact FUT.GG player URL for strong identity', () => {
    expect(
      createFutggResearchLink({
        playerName: 'Alex Example',
        identityConfidence: 1,
        confirmedExactUrl:
          'https://www.fut.gg/players/alex-example/26-12345678/',
      }).mode,
    ).toBe('exact');
  });

  it('rejects an exact URL on another host', () => {
    expect(
      createFutggResearchLink({
        playerName: 'Alex Example',
        identityConfidence: 1,
        confirmedExactUrl: 'https://example.com/players/alex-example/',
      }).mode,
    ).toBe('search');
  });
});
