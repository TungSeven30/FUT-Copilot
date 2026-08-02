import type { NormalizedAdapterEvent } from '@fut-copilot/domain/adapter-events';

import { extractActiveSquadEvent } from './active-squad';
import { classifyScreen } from './screen-classifier';
import { extractSelectedCardEvent } from './selected-card';

type ExtractVisibleContextOptions = {
  createId?: () => string;
  now?: () => Date;
};

export function extractVisibleContextEvent(
  document: Document,
  options: ExtractVisibleContextOptions = {},
): NormalizedAdapterEvent {
  return classifyScreen(document).screen === 'active-squad'
    ? extractActiveSquadEvent(document, options)
    : extractSelectedCardEvent(document, options);
}
