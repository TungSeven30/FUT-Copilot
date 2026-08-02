import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapterSnapshotSchema } from '@fut-copilot/domain/messages';

const browserMocks = vi.hoisted(() => {
  const listeners = new Set<(message: unknown) => unknown>();
  const state = { snapshot: null as unknown };
  return {
    listeners,
    state,
    sendMessage: vi.fn(async (message: unknown) => {
      const kind = (message as { kind?: string }).kind;
      if (kind === 'adapter.snapshot.get') {
        return { kind: 'adapter.snapshot', snapshot: state.snapshot };
      }
      if (kind === 'adapter.observe.request') {
        return {
          kind: 'adapter.ack',
          accepted: false,
          reason: 'active-tab-unavailable',
        };
      }
      return { kind: 'adapter.ack', accepted: true };
    }),
  };
});

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      onMessage: {
        addListener(listener: (message: unknown) => unknown) {
          browserMocks.listeners.add(listener);
        },
        removeListener(listener: (message: unknown) => unknown) {
          browserMocks.listeners.delete(listener);
        },
      },
      sendMessage: browserMocks.sendMessage,
    },
  },
}));

import { App } from './App';
import { selectedCardFromSnapshot } from './selected-context';

let mountedRoot: Root | null = null;

async function flushUi(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

afterEach(async () => {
  if (mountedRoot !== null) {
    await act(async () => mountedRoot?.unmount());
    mountedRoot = null;
  }
  browserMocks.listeners.clear();
  browserMocks.sendMessage.mockClear();
  browserMocks.state.snapshot = null;
});

describe('FUT Copilot side panel', () => {
  it('renders every MVP workspace and the manual-action boundary', () => {
    const markup = renderToStaticMarkup(<App />);

    for (const workspace of [
      'context',
      'duplicates',
      'sbc',
      'market',
      'settings',
    ]) {
      expect(markup).toContain(`>${workspace}</button>`);
    }
    expect(markup).toContain('You stay in control.');
    expect(markup).toContain(
      'No automatic buy, list, submit, discard, or quick-sell.',
    );
    expect(markup).toContain('Observing visible context…');
  });

  it('moves through every side-panel workspace after a disconnected start', async () => {
    const container = document.createElement('div');
    mountedRoot = createRoot(container);
    await act(async () => mountedRoot?.render(<App />));
    await flushUi();

    expect(container.textContent).toContain('No Web App observation yet');

    const expectedHeadings = new Map([
      ['context', 'Selected context'],
      ['duplicates', 'Duplicate triage'],
      ['sbc', 'SBC planner'],
      ['market', 'Market workspace'],
      ['settings', 'Settings and health'],
    ]);
    for (const [tabName, heading] of expectedHeadings) {
      const tab = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent === tabName,
      );
      if (tab === undefined) throw new Error(`Missing ${tabName} tab.`);
      await act(async () => {
        tab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(container.querySelector('#context-title')?.textContent).toBe(
        heading,
      );
    }
  });

  it('shows a fail-closed error when the active tab cannot be observed', async () => {
    const container = document.createElement('div');
    mountedRoot = createRoot(container);
    await act(async () => mountedRoot?.render(<App />));
    await flushUi();

    const observe = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Observe visible context',
    );
    if (observe === undefined) throw new Error('Missing observe button.');
    await act(async () => {
      observe.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushUi();

    expect(container.textContent).toContain('Could not observe the active tab');
    expect(container.textContent).toContain('active-tab-unavailable');
  });

  it('renders a live active-squad summary without inventing player names', async () => {
    const observedAt = '2026-08-01T18:00:00.000Z';
    const unknownString = {
      value: null,
      source: 'ea-visible-ui',
      observedAt,
      status: 'unknown',
    } as const;
    const groups = [
      ['starting', 'START', 11],
      ['bench', 'SUB', 7],
      ['reserves', 'RES', 5],
    ] as const;
    browserMocks.state.snapshot = {
      state: 'ready',
      updatedAt: observedAt,
      event: {
        eventVersion: 1,
        eventId: '9d1a83a0-d505-461f-a44a-2f999d93bcbc',
        type: 'activeSquad.visible',
        webAppBuild: unknownString,
        occurredAt: observedAt,
        confidence: 0.9,
        extractionStatus: 'inferred',
        adapterVersion: 'fc26-web-v0.3.0',
        payload: {
          slots: groups.flatMap(([group, prefix, count]) =>
            Array.from({ length: count }, (_, index) => ({
              slot: `${prefix}-${index + 1}`,
              group,
              card:
                group === 'starting' && index === 0
                  ? {
                      localObservationId:
                        'b28833ed-3d5d-4f3d-bb97-cb9b31ac551a',
                      name: unknownString,
                      overall: {
                        value: 89,
                        source: 'ea-visible-ui',
                        observedAt,
                        status: 'known',
                      },
                      position: {
                        value: 'ST',
                        source: 'ea-visible-ui',
                        observedAt,
                        status: 'known',
                      },
                      club: unknownString,
                      league: unknownString,
                      nation: unknownString,
                      rarity: unknownString,
                      tradeability: unknownString,
                      firstOwner: unknownString,
                      loan: {
                        value: false,
                        source: 'ea-visible-ui',
                        observedAt,
                        status: 'inferred',
                      },
                      faceStats: [],
                    }
                  : null,
            })),
          ),
        },
      },
    };
    const container = document.createElement('div');
    mountedRoot = createRoot(container);
    await act(async () => mountedRoot?.render(<App />));
    await flushUi();

    expect(container.textContent).toContain('Active squad');
    expect(container.textContent).toContain('1/23 player slots occupied');
    expect(container.textContent).toContain('89 · ST');
    expect(container.textContent).toContain(
      'keeps them unknown instead of matching by image or hidden data',
    );
  });

  it('renders live Transfer List context as read-only displayed values', async () => {
    const observedAt = '2026-08-01T20:00:00.000Z';
    const unknownString = {
      value: null,
      source: 'ea-visible-ui',
      observedAt,
      status: 'unknown',
    } as const;
    browserMocks.state.snapshot = {
      state: 'ready',
      updatedAt: observedAt,
      event: {
        eventVersion: 1,
        eventId: 'd64d1930-ee85-4c00-806a-214ed44cb5b1',
        type: 'marketContext.visible',
        webAppBuild: unknownString,
        occurredAt: observedAt,
        confidence: 0.94,
        extractionStatus: 'known',
        adapterVersion: 'fc26-web-v0.3.0',
        payload: {
          selectedCard: {
            localObservationId: '698ff715-6d26-4738-8a61-aac27a1f1f18',
            name: {
              value: 'Alex Transfer',
              source: 'ea-visible-ui',
              observedAt,
              status: 'known',
            },
            overall: {
              value: 90,
              source: 'ea-visible-ui',
              observedAt,
              status: 'known',
            },
            position: {
              value: 'CM',
              source: 'ea-visible-ui',
              observedAt,
              status: 'known',
            },
            club: unknownString,
            league: unknownString,
            nation: unknownString,
            rarity: {
              value: 'special',
              source: 'ea-visible-ui',
              observedAt,
              status: 'inferred',
            },
            tradeability: {
              value: 'tradeable',
              source: 'ea-visible-ui',
              observedAt,
              status: 'inferred',
            },
            firstOwner: unknownString,
            loan: {
              value: false,
              source: 'ea-visible-ui',
              observedAt,
              status: 'inferred',
            },
            faceStats: [],
          },
          displayedPrices: [
            {
              value: 120_000,
              source: 'ea-visible-ui',
              observedAt,
              status: 'known',
            },
            {
              value: 135_000,
              source: 'ea-visible-ui',
              observedAt,
              status: 'known',
            },
          ],
        },
      },
    };

    const container = document.createElement('div');
    mountedRoot = createRoot(container);
    await act(async () => mountedRoot?.render(<App />));
    await flushUi();

    expect(container.textContent).toContain('Transfer List context');
    expect(container.textContent).toContain('Alex Transfer');
    expect(container.textContent).toContain('120,000 coins');
    expect(container.textContent).toContain('135,000 coins');
    expect(container.textContent).toContain('not saved as a market price');
    expect(container.textContent).toContain(
      'never activates Watch, Bid, Buy, List, or Re-list',
    );
  });

  it('renders Transfer Market values without creating owned-card context', async () => {
    const observedAt = '2026-08-01T22:00:00.000Z';
    const unknownString = {
      value: null,
      source: 'ea-visible-ui',
      observedAt,
      status: 'unknown',
    } as const;
    browserMocks.state.snapshot = {
      state: 'ready',
      updatedAt: observedAt,
      event: {
        eventVersion: 1,
        eventId: 'a05f6ad4-00b5-4282-b290-1017cf9ae114',
        type: 'marketContext.visible',
        webAppBuild: unknownString,
        occurredAt: observedAt,
        confidence: 0.95,
        extractionStatus: 'known',
        adapterVersion: 'fc26-web-v0.5.0',
        payload: {
          selectedCard: {
            localObservationId: 'fd0fd6cc-6d39-456b-800b-2fb22f2e2e67',
            name: {
              value: 'Alex Market',
              source: 'ea-visible-ui',
              observedAt,
              status: 'known',
            },
            overall: {
              value: 91,
              source: 'ea-visible-ui',
              observedAt,
              status: 'known',
            },
            position: {
              value: 'RW',
              source: 'ea-visible-ui',
              observedAt,
              status: 'known',
            },
            club: unknownString,
            league: unknownString,
            nation: unknownString,
            rarity: unknownString,
            tradeability: {
              value: 'tradeable',
              source: 'ea-visible-ui',
              observedAt,
              status: 'inferred',
              evidence: ['visible-transfer-market-context'],
            },
            firstOwner: unknownString,
            loan: {
              value: false,
              source: 'ea-visible-ui',
              observedAt,
              status: 'inferred',
            },
            faceStats: [],
          },
          displayedPrices: [
            {
              value: 12_000,
              source: 'ea-visible-ui',
              observedAt,
              status: 'known',
              evidence: ['visible-transfer-market-start-price'],
            },
            {
              value: 24_000,
              source: 'ea-visible-ui',
              observedAt,
              status: 'known',
              evidence: ['visible-transfer-market-buy-now-price'],
            },
          ],
        },
      },
    };
    expect(
      selectedCardFromSnapshot(
        adapterSnapshotSchema.parse(browserMocks.state.snapshot),
      ),
    ).toBeNull();

    const container = document.createElement('div');
    mountedRoot = createRoot(container);
    await act(async () => mountedRoot?.render(<App />));
    await flushUi();

    expect(container.textContent).toContain('Transfer Market context');
    expect(container.textContent).toContain('Start price12,000 coins');
    expect(container.textContent).toContain('Buy Now price24,000 coins');
    expect(container.textContent).toContain(
      'never activates Watch, Bid, Buy, List, or Re-list',
    );
  });

  it('renders live SBC requirements as read-only context', async () => {
    const observedAt = '2026-08-01T21:00:00.000Z';
    const unknownString = {
      value: null,
      source: 'ea-visible-ui',
      observedAt,
      status: 'unknown',
    } as const;
    browserMocks.state.snapshot = {
      state: 'ready',
      updatedAt: observedAt,
      event: {
        eventVersion: 1,
        eventId: '838af32e-cf54-40d7-9554-b5560542ae59',
        type: 'sbcContext.visible',
        webAppBuild: unknownString,
        occurredAt: observedAt,
        confidence: 0.94,
        extractionStatus: 'inferred',
        adapterVersion: 'fc26-web-v0.4.0',
        payload: {
          challengeName: {
            value: 'Daily Login Example',
            source: 'ea-visible-ui',
            observedAt,
            status: 'known',
          },
          segmentName: unknownString,
          requirementLabels: [
            {
              value: 'Player Quality: Exactly Bronze',
              source: 'ea-visible-ui',
              observedAt,
              status: 'known',
            },
            {
              value: 'Number of Players in the Squad: 1',
              source: 'ea-visible-ui',
              observedAt,
              status: 'known',
            },
          ],
          cards: [],
        },
      },
    };

    const container = document.createElement('div');
    mountedRoot = createRoot(container);
    await act(async () => mountedRoot?.render(<App />));
    await flushUi();

    expect(container.textContent).toContain('SBC context');
    expect(container.textContent).toContain('Daily Login Example');
    expect(container.textContent).toContain('Player Quality: Exactly Bronze');
    expect(container.textContent).toContain(
      'Number of Players in the Squad: 1',
    );
    expect(container.textContent).toContain('never fills or submits the squad');
  });
});
