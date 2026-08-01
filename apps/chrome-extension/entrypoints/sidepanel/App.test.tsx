import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { App } from './App';

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
});
