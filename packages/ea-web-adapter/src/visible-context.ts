import type { NormalizedAdapterEvent } from '@fut-copilot/domain/adapter-events';

import { extractActiveSquadEvent } from './active-squad';
import { extractPackResultEvent } from './pack-result';
import { classifyScreen } from './screen-classifier';
import { extractSbcContextEvent } from './sbc-context';
import { extractSelectedCardEvent } from './selected-card';
import { extractTransferListEvent } from './transfer-list';
import { extractTransferMarketEvent } from './transfer-market';

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
  if (screen === 'pack-result') {
    return extractPackResultEvent(document, options);
  }
  if (screen === 'transfer-list') {
    return extractTransferListEvent(document, options);
  }
  if (screen === 'transfer-market') {
    return extractTransferMarketEvent(document, options);
  }
  if (screen === 'sbc') {
    return extractSbcContextEvent(document, options);
  }
  return extractSelectedCardEvent(document, options);
}
