import {
  adapterEventMessageSchema,
  adapterObserveRequestMessageSchema,
  adapterSnapshotGetMessageSchema,
  adapterSnapshotSchema,
  createAdapterSnapshot,
  type AdapterSnapshot,
} from '@fut-copilot/domain/messages';
import { browser } from 'wxt/browser';

const SNAPSHOT_STORAGE_KEY = 'adapterSnapshot.v1';

async function readSnapshot(): Promise<AdapterSnapshot | null> {
  const stored = await browser.storage.local.get(SNAPSHOT_STORAGE_KEY);
  const parsed = adapterSnapshotSchema.safeParse(stored[SNAPSHOT_STORAGE_KEY]);
  return parsed.success ? parsed.data : null;
}

async function storeSnapshot(snapshot: AdapterSnapshot): Promise<void> {
  await browser.storage.local.set({ [SNAPSHOT_STORAGE_KEY]: snapshot });
}

async function broadcastSnapshot(snapshot: AdapterSnapshot): Promise<void> {
  await browser.runtime
    .sendMessage({ kind: 'adapter.snapshot.changed', snapshot })
    .catch(() => undefined);
}

async function requestObservationFromActiveTab() {
  const tabs = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  const activeTabId = tabs.find((tab) => tab.id !== undefined)?.id;
  if (activeTabId === undefined) {
    return {
      kind: 'adapter.ack' as const,
      accepted: false,
      reason: 'active-tab-unavailable',
    };
  }

  return browser.tabs.sendMessage(activeTabId, {
    kind: 'adapter.observe.now',
  });
}

export default defineBackground(() => {
  if (browser.sidePanel !== undefined) {
    void browser.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true,
    });
  }

  browser.runtime.onMessage.addListener((message: unknown) => {
    const eventMessage = adapterEventMessageSchema.safeParse(message);
    if (eventMessage.success) {
      const snapshot = createAdapterSnapshot(eventMessage.data.event);
      if (snapshot === null) {
        return Promise.resolve({
          kind: 'adapter.ack' as const,
          accepted: false,
          reason: 'unsupported-event-type',
        });
      }

      return storeSnapshot(snapshot)
        .then(() => broadcastSnapshot(snapshot))
        .then(() => ({ kind: 'adapter.ack' as const, accepted: true }));
    }

    if (adapterSnapshotGetMessageSchema.safeParse(message).success) {
      return readSnapshot().then((snapshot) => ({
        kind: 'adapter.snapshot' as const,
        snapshot,
      }));
    }

    if (adapterObserveRequestMessageSchema.safeParse(message).success) {
      return requestObservationFromActiveTab();
    }

    return undefined;
  });
});
