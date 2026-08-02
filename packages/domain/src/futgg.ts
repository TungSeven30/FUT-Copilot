const FUTGG_ORIGIN = 'https://www.fut.gg';

export type FutggResearchLink = {
  mode: 'exact' | 'search';
  url: string;
  label: string;
};

function isSafeExactPlayerUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.origin === FUTGG_ORIGIN &&
      /^\/players\/[^/]+\/(?:[^/]+\/)?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function createFutggResearchLink(input: {
  playerName: string;
  identityConfidence: number;
  confirmedExactUrl?: string;
}): FutggResearchLink {
  if (
    input.identityConfidence >= 0.95 &&
    input.confirmedExactUrl !== undefined &&
    isSafeExactPlayerUrl(input.confirmedExactUrl)
  ) {
    return {
      mode: 'exact',
      url: input.confirmedExactUrl,
      label: 'Open exact FUT.GG card',
    };
  }

  const url = new URL('/players/', FUTGG_ORIGIN);
  url.searchParams.set('name', input.playerName.trim());
  return {
    mode: 'search',
    url: url.toString(),
    label: `Search FUT.GG for ${input.playerName.trim()}`,
  };
}
