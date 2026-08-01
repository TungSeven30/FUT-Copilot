import {
  adapterAcknowledgeResponseSchema,
  adapterObserveNowMessageSchema,
  protectionStatusResponseSchema,
} from '@fut-copilot/domain/messages';
import { createAdapterEventSignature } from '@fut-copilot/ea-web-adapter/event-signature';
import { extractSelectedCardEvent } from '@fut-copilot/ea-web-adapter/selected-card';
import { browser } from 'wxt/browser';

const EA_WEB_APP_MATCH =
  'https://www.ea.com/ea-sports-fc/ultimate-team/web-app/*';
const MUTATION_DEBOUNCE_MS = 160;
const PROTECTION_HOST_ID = 'fut-copilot-protection-status';

function removeProtectionStatus(): void {
  document.getElementById(PROTECTION_HOST_ID)?.remove();
}

function renderProtectionStatus(
  status: 'protected' | 'ambiguous',
  tagNames: string[],
): void {
  let host = document.getElementById(PROTECTION_HOST_ID);
  if (host === null) {
    host = document.createElement('div');
    host.id = PROTECTION_HOST_ID;
    document.body.append(host);
  }
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  const label =
    status === 'protected'
      ? `Protected card${tagNames.length > 0 ? ` · ${tagNames.join(', ')}` : ''}`
      : 'Card identity needs review';
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    div {
      position: fixed;
      z-index: 2147483647;
      top: 14px;
      right: 14px;
      max-width: 260px;
      padding: 10px 12px;
      border: 1px solid ${status === 'protected' ? '#ff6b6b' : '#ff9f1c'};
      border-radius: 10px;
      color: #f7f7f2;
      background: #151b18;
      box-shadow: 0 10px 30px rgb(0 0 0 / 35%);
      font: 800 12px/1.35 system-ui, sans-serif;
      pointer-events: none;
    }
  `;
  const badge = document.createElement('div');
  badge.setAttribute('role', 'status');
  badge.textContent = `FUT Copilot · ${label}`;
  shadow.replaceChildren(style, badge);
}

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

      if (event.type === 'card.selected' && event.payload.card !== null) {
        const protectionResponse = await browser.runtime.sendMessage({
          kind: 'protection.status.request',
          card: event.payload.card,
        });
        const protection =
          protectionStatusResponseSchema.parse(protectionResponse);
        if (protection.status === 'clear') {
          removeProtectionStatus();
        } else {
          renderProtectionStatus(protection.status, protection.tagNames);
        }
      } else {
        removeProtectionStatus();
      }
    };

    const scheduleObservation = () => {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        void publishObservation(false).catch(removeProtectionStatus);
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
    void publishObservation(true).catch(removeProtectionStatus);

    context.onInvalidated(() => {
      mutationObserver.disconnect();
      browser.runtime.onMessage.removeListener(onMessage);
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
      removeProtectionStatus();
    });
  },
});
