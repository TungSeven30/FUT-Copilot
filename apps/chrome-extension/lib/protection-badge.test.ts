import { afterEach, describe, expect, it } from 'vitest';

import {
  PROTECTION_HOST_ID,
  removeProtectionStatus,
  renderProtectionStatus,
} from './protection-badge';

describe('on-page protection badge', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('renders one non-interactive status inside Shadow DOM', () => {
    renderProtectionStatus('protected', ['favorite'], document);

    const host = document.getElementById(PROTECTION_HOST_ID);
    const badge = host?.shadowRoot?.querySelector('[role="status"]');
    const style = host?.shadowRoot?.querySelector('style');
    expect(host).not.toBeNull();
    expect(badge?.textContent).toBe('FUT Copilot · Protected card · favorite');
    expect(style?.textContent).toContain('pointer-events: none');
    expect(host?.shadowRoot?.querySelector('button')).toBeNull();
  });

  it('updates idempotently and disappears on context cleanup', () => {
    renderProtectionStatus('protected', ['favorite'], document);
    renderProtectionStatus('ambiguous', [], document);

    const hosts = document.querySelectorAll(`#${PROTECTION_HOST_ID}`);
    expect(hosts).toHaveLength(1);
    expect(
      hosts[0]?.shadowRoot?.querySelectorAll('[role="status"]'),
    ).toHaveLength(1);
    expect(
      hosts[0]?.shadowRoot?.querySelector('[role="status"]')?.textContent,
    ).toBe('FUT Copilot · Card identity needs review');

    removeProtectionStatus(document);
    expect(document.getElementById(PROTECTION_HOST_ID)).toBeNull();
  });
});
