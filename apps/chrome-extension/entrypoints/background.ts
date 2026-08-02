import {
  adapterEventMessageSchema,
  adapterObserveRequestMessageSchema,
  adapterSnapshotGetMessageSchema,
  adapterSnapshotSchema,
  createAdapterSnapshot,
  protectionStatusRequestMessageSchema,
  type AdapterSnapshot,
} from '@fut-copilot/domain/messages';
import { FutCopilotDatabase } from '@fut-copilot/storage/database';
import {
  createDuplicateCaseFromEvent,
  createDuplicateCasesFromPackResultEvent,
} from '@fut-copilot/storage/duplicates';
import { persistNormalizedAdapterEvent } from '@fut-copilot/storage/observations';
import { ensureSelectedCardContext } from '@fut-copilot/storage/personalization';
import { browser } from 'wxt/browser';

const SNAPSHOT_STORAGE_KEY = 'adapterSnapshot.v1';
const database = new FutCopilotDatabase();

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

async function persistAdapterEvent(
  event: Parameters<typeof createAdapterSnapshot>[0],
): Promise<Parameters<typeof createAdapterSnapshot>[0]> {
  const persisted = await persistNormalizedAdapterEvent(database, event);
  if (persisted.event.type === 'duplicate.detected') {
    await createDuplicateCaseFromEvent(database, persisted.event);
  }
  if (persisted.event.type === 'packResult.visible') {
    await createDuplicateCasesFromPackResultEvent(database, persisted.event);
  }
  return persisted.event;
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
      if (createAdapterSnapshot(eventMessage.data.event) === null) {
        return Promise.resolve({
          kind: 'adapter.ack' as const,
          accepted: false,
          reason: 'unsupported-event-type',
        });
      }

      return persistAdapterEvent(eventMessage.data.event).then(
        async (event) => {
          const snapshot = createAdapterSnapshot(event);
          if (snapshot === null) {
            throw new Error('Persisted adapter event became unsupported.');
          }
          await storeSnapshot(snapshot);
          await broadcastSnapshot(snapshot);
          return { kind: 'adapter.ack' as const, accepted: true };
        },
      );
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

    const protectionRequest =
      protectionStatusRequestMessageSchema.safeParse(message);
    if (protectionRequest.success) {
      return ensureSelectedCardContext(
        database,
        protectionRequest.data.card,
      ).then((context) => {
        if (context.ownedCard === null) {
          return {
            kind: 'protection.status' as const,
            status: 'ambiguous' as const,
            tagNames: [],
          };
        }
        const selectedTags = context.tags.filter((tag) =>
          context.ownedCard?.personalTagIds.includes(tag.id),
        );
        const protectedCard =
          context.ownedCard.protected ||
          selectedTags.some((tag) => tag.protectsCard);
        return {
          kind: 'protection.status' as const,
          status: protectedCard ? ('protected' as const) : ('clear' as const),
          tagNames: selectedTags.map((tag) => tag.name),
        };
      });
    }

    return undefined;
  });
});
