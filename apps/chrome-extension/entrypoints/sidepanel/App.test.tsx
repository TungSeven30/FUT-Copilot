import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapterSnapshotSchema } from '@fut-copilot/domain/messages';
import type { VisibleCard } from '@fut-copilot/domain/adapter-events';

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

function makeVisibleCard(input: {
  id: string;
  name: string;
  observedAt: string;
  overall: number;
  position: string;
}): VisibleCard {
  const unknown = {
    value: null,
    source: 'ea-visible-ui' as const,
    observedAt: input.observedAt,
    status: 'unknown' as const,
  };
  return {
    localObservationId: input.id,
    name: {
      value: input.name,
      source: 'ea-visible-ui',
      observedAt: input.observedAt,
      status: 'known',
    },
    overall: {
      value: input.overall,
      source: 'ea-visible-ui',
      observedAt: input.observedAt,
      status: 'known',
    },
    position: {
      value: input.position,
      source: 'ea-visible-ui',
      observedAt: input.observedAt,
      status: 'known',
    },
    club: unknown,
    league: unknown,
    nation: unknown,
    rarity: unknown,
    tradeability: unknown,
    firstOwner: unknown,
    loan: {
      value: false,
      source: 'ea-visible-ui',
      observedAt: input.observedAt,
      status: 'inferred',
    },
    faceStats: [],
  };
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
    expect(container.textContent).toContain(
      'Club, squad, Unassigned pack, Transfer List, Transfer Market, or SBC',
    );

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

  it('reports the current live and synthetic compatibility boundary', async () => {
    const container = document.createElement('div');
    mountedRoot = createRoot(container);
    await act(async () => mountedRoot?.render(<App />));
    await flushUi();

    const settings = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'settings',
    );
    if (settings === undefined) throw new Error('Missing settings tab.');
    await act(async () => {
      settings.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (container.textContent.includes('Live-supported screens')) break;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
    }

    expect(container.textContent).toContain(
      'English Club card, squad, Unassigned pack, Transfer List, market + empty SBC',
    );
    expect(container.textContent).toContain(
      'Synthetic-only contextsPlayer pick + populated SBC',
    );
    expect(container.textContent).toContain('fc26-web-v0.6.0');
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

  it('renders pack-result cards in normalized visible order', async () => {
    const observedAt = '2026-08-02T14:00:00.000Z';
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
        eventId: '98e61e96-a230-414b-89e7-70a68df42276',
        type: 'packResult.visible',
        webAppBuild: unknownString,
        occurredAt: observedAt,
        confidence: 0.91,
        extractionStatus: 'known',
        adapterVersion: 'synthetic-fixture-v1',
        payload: {
          cards: [
            makeVisibleCard({
              id: '438a2c4f-68bd-49a2-809c-5989970b65c5',
              name: 'Pack First',
              observedAt,
              overall: 90,
              position: 'ST',
            }),
            makeVisibleCard({
              id: 'f62cfa13-63a7-449b-a2b8-bffab8b7f2a2',
              name: 'Pack Second',
              observedAt,
              overall: 86,
              position: 'CM',
            }),
          ],
          duplicateIndexes: [1],
        },
      },
    };

    const container = document.createElement('div');
    mountedRoot = createRoot(container);
    await act(async () => mountedRoot?.render(<App />));
    await flushUi();

    expect(container.textContent).toContain('Pack result');
    expect(container.textContent).toContain('2 visible cards');
    expect(
      Array.from(
        container.querySelectorAll(
          '[aria-label="Ordered pack-result cards"] small',
        ),
      ).map((element) => element.textContent),
    ).toEqual(['Pack First', 'Pack Second']);
    expect(container.textContent).toContain('Pack card 2 · duplicate');
    expect(container.textContent).toContain('including 1 duplicate');
    expect(container.textContent).toContain(
      'cannot open the pack, send an item, or advance the result screen',
    );
  });

  it('renders player-pick options without a selection control', async () => {
    const observedAt = '2026-08-02T14:10:00.000Z';
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
        eventId: '2267124c-6b70-4e16-910c-87bf8fb193fa',
        type: 'playerPick.visible',
        webAppBuild: unknownString,
        occurredAt: observedAt,
        confidence: 0.9,
        extractionStatus: 'known',
        adapterVersion: 'synthetic-fixture-v1',
        payload: {
          options: [
            makeVisibleCard({
              id: '7402da34-d8f6-4a30-92f0-b481a20b572a',
              name: 'Pick First',
              observedAt,
              overall: 92,
              position: 'LW',
            }),
            makeVisibleCard({
              id: 'd6dd01e1-0428-45a2-9cec-693148652627',
              name: 'Pick Second',
              observedAt,
              overall: 91,
              position: 'RW',
            }),
          ],
          selectedIndex: null,
        },
      },
    };

    const container = document.createElement('div');
    mountedRoot = createRoot(container);
    await act(async () => mountedRoot?.render(<App />));
    await flushUi();

    expect(container.textContent).toContain('Player pick');
    expect(container.textContent).toContain('no option selected');
    expect(container.textContent).toContain('Option 1Pick First92 · LW');
    expect(container.textContent).toContain('Option 2Pick Second91 · RW');
    expect(container.textContent).toContain(
      'never selects or confirms a player-pick option',
    );
  });

  it('renders duplicate detection as a local-only triage event', async () => {
    const observedAt = '2026-08-02T14:20:00.000Z';
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
        eventId: '5e84901d-286d-4ed8-a6f3-528707b60c3f',
        type: 'duplicate.detected',
        webAppBuild: unknownString,
        occurredAt: observedAt,
        confidence: 0.95,
        extractionStatus: 'known',
        adapterVersion: 'synthetic-fixture-v1',
        payload: {
          duplicate: makeVisibleCard({
            id: 'a18f4058-d984-4d62-9547-afd45d55107c',
            name: 'Duplicate Example',
            observedAt,
            overall: 88,
            position: 'CB',
          }),
          existingCard: null,
        },
      },
    };

    const container = document.createElement('div');
    mountedRoot = createRoot(container);
    await act(async () => mountedRoot?.render(<App />));
    await flushUi();

    expect(container.textContent).toContain('Duplicate detected');
    expect(container.textContent).toContain('Duplicate Example');
    expect(container.textContent).toContain('Existing copy visibleNo');
    expect(container.textContent).toContain(
      'creates or updates one local triage case',
    );
    expect(container.textContent).toContain(
      'never sends, lists, submits, discards, or quick-sells',
    );
  });
});
