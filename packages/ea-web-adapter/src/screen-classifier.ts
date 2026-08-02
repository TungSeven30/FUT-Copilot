import type { ScreenKind } from '@fut-copilot/domain/adapter-events';

const CLUB_HEADING = 'My Club Players';
const TRANSFER_LIST_HEADING = 'Transfer List';
const TRANSFER_MARKET_RESULTS_HEADING = 'Search Results';

export type ScreenClassification = {
  screen: ScreenKind;
  confidence: number;
  evidenceCodes: string[];
};

function normalizeText(value: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

export function classifyScreen(document: Document): ScreenClassification {
  const headings = document.querySelectorAll('.ut-root-view h1.title');
  const headingText = normalizeText(headings[0]?.textContent ?? null);
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

  const transferMarketResults = document.querySelectorAll(
    '.ut-pinned-list-container.SearchResults',
  );
  if (
    headingText === TRANSFER_MARKET_RESULTS_HEADING &&
    transferMarketResults.length === 1
  ) {
    return {
      screen: 'transfer-market',
      confidence: 0.99,
      evidenceCodes: [
        'transfer-market-results-heading-visible',
        'transfer-market-results-view-visible',
      ],
    };
  }

  const sbcPanels = document.querySelectorAll('.SquadPanel.SBCSquadPanel');
  const sbcDetails = document.querySelectorAll(
    '.ut-sbc-challenge-details-view',
  );
  const sbcPitches = document.querySelectorAll('.ut-squad-pitch-view.sbc');
  const sbcDocks = document.querySelectorAll('.ut-squad-slot-dock-view.sbc');
  if (
    headings.length === 1 &&
    headingText !== '' &&
    sbcPanels.length === 1 &&
    sbcDetails.length === 1 &&
    sbcPitches.length === 1 &&
    sbcDocks.length === 1
  ) {
    return {
      screen: 'sbc',
      confidence: 0.99,
      evidenceCodes: [
        'sbc-challenge-heading-visible',
        'sbc-challenge-panel-visible',
        'sbc-details-view-visible',
        'sbc-pitch-visible',
        'sbc-work-area-visible',
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
