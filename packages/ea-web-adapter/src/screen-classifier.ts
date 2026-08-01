import type { ScreenKind } from '@fut-copilot/domain/adapter-events';

const CLUB_HEADING = 'My Club Players';

export type ScreenClassification = {
  screen: ScreenKind;
  confidence: number;
  evidenceCodes: string[];
};

function normalizeText(value: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

export function classifyScreen(document: Document): ScreenClassification {
  const heading = document.querySelector('.ut-root-view h1.title');
  if (normalizeText(heading?.textContent ?? null) === CLUB_HEADING) {
    return {
      screen: 'club',
      confidence: 0.98,
      evidenceCodes: ['club-heading-visible'],
    };
  }

  return {
    screen: 'unknown',
    confidence: 0,
    evidenceCodes: ['no-supported-screen-anchor'],
  };
}
