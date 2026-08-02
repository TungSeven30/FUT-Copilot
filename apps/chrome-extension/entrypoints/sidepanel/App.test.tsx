import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const browserMocks = vi.hoisted(() => {
  const listeners = new Set<(message: unknown) => unknown>();
  return {
    listeners,
    sendMessage: vi.fn(async (message: unknown) => {
      const kind = (message as { kind?: string }).kind;
      if (kind === 'adapter.snapshot.get') {
        return { kind: 'adapter.snapshot', snapshot: null };
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
    expect(markup).toContain('Observing selected card…');
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
      (button) => button.textContent === 'Observe selected card',
    );
    if (observe === undefined) throw new Error('Missing observe button.');
    await act(async () => {
      observe.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushUi();

    expect(container.textContent).toContain('Could not observe the active tab');
    expect(container.textContent).toContain('active-tab-unavailable');
  });
});
