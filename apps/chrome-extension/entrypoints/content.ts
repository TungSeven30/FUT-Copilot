import {
  adapterAcknowledgeResponseSchema,
  adapterObserveNowMessageSchema,
} from '@fut-copilot/domain/messages';
import { createAdapterEventSignature } from '@fut-copilot/ea-web-adapter/event-signature';
import { extractSelectedCardEvent } from '@fut-copilot/ea-web-adapter/selected-card';
import { browser } from 'wxt/browser';

const EA_WEB_APP_MATCH =
  'https://www.ea.com/ea-sports-fc/ultimate-team/web-app/*';
const MUTATION_DEBOUNCE_MS = 160;

export default defineContentScript({
  matches: [EA_WEB_APP_MATCH],
  runAt: 'document_idle',
  main(context) {
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let lastSignature: string | undefined;

    const publishObservation = async (force: boolean) => {
      const event = extractSelectedCardEvent(document);
      const signature = createAdapterEventSignature(event);
      if (!force && signature === lastSignature) {
        return;
      }

      lastSignature = signature;
      const response = await browser.runtime.sendMessage({
        kind: 'adapter.event',
        event,
      });
      adapterAcknowledgeResponseSchema.parse(response);
    };

    const scheduleObservation = () => {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        void publishObservation(false);
      }, MUTATION_DEBOUNCE_MS);
    };

    const mutationObserver = new MutationObserver(scheduleObservation);
    mutationObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['aria-hidden', 'class', 'style'],
      characterData: true,
      childList: true,
      subtree: true,
    });

    const onMessage = (message: unknown) => {
      if (!adapterObserveNowMessageSchema.safeParse(message).success) {
        return undefined;
      }

      return publishObservation(true).then(
        () => ({ kind: 'adapter.ack' as const, accepted: true }),
        () => ({
          kind: 'adapter.ack' as const,
          accepted: false,
          reason: 'observation-failed',
        }),
      );
    };

    browser.runtime.onMessage.addListener(onMessage);
    void publishObservation(true);

    context.onInvalidated(() => {
      mutationObserver.disconnect();
      browser.runtime.onMessage.removeListener(onMessage);
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
    });
  },
});
