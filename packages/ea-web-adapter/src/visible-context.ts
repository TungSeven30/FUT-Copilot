import type { NormalizedAdapterEvent } from '@fut-copilot/domain/adapter-events';

import { extractActiveSquadEvent } from './active-squad';
import { classifyScreen } from './screen-classifier';
import { extractSelectedCardEvent } from './selected-card';
import { extractTransferListEvent } from './transfer-list';

type ExtractVisibleContextOptions = {
  createId?: () => string;
  now?: () => Date;
};

export function extractVisibleContextEvent(
  document: Document,
  options: ExtractVisibleContextOptions = {},
): NormalizedAdapterEvent {
  const screen = classifyScreen(document).screen;
  if (screen === 'active-squad') {
    return extractActiveSquadEvent(document, options);
  }
  if (screen === 'transfer-list') {
    return extractTransferListEvent(document, options);
  }
  return extractSelectedCardEvent(document, options);
}
