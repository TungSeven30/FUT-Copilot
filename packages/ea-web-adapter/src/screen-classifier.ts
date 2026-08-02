import type { ScreenKind } from '@fut-copilot/domain/adapter-events';

const CLUB_HEADING = 'My Club Players';
const TRANSFER_LIST_HEADING = 'Transfer List';

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
  const headingText = normalizeText(heading?.textContent ?? null);
  const transferLists = document.querySelectorAll('.ut-transfer-list-view');
  if (headingText === TRANSFER_LIST_HEADING && transferLists.length === 1) {
    return {
      screen: 'transfer-list',
      confidence: 0.99,
      evidenceCodes: [
        'transfer-list-heading-visible',
        'transfer-list-view-visible',
      ],
    };
  }

  const squadActions = document.querySelectorAll('.ut-squad-actions-view');
  const squadOverviews = document.querySelectorAll('.ut-squad-overview');
  const squadPitches = document.querySelectorAll('.ut-squad-pitch-view');
  const squadDocks = document.querySelectorAll(
    '.ut-squad-slot-dock-view--slot-container',
  );
  if (
    squadActions.length === 1 &&
    squadOverviews.length === 1 &&
    squadPitches.length === 1 &&
    squadDocks.length === 2
  ) {
    return {
      screen: 'active-squad',
      confidence: 0.99,
      evidenceCodes: [
        'squad-actions-view-visible',
        'squad-overview-visible',
        'squad-pitch-visible',
        'bench-reserve-docks-visible',
      ],
    };
  }

  if (headingText === CLUB_HEADING) {
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
