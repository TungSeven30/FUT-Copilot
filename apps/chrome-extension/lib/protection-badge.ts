export const PROTECTION_HOST_ID = 'fut-copilot-protection-status';

export function removeProtectionStatus(
  rootDocument: Document = document,
): void {
  rootDocument.getElementById(PROTECTION_HOST_ID)?.remove();
}

export function renderProtectionStatus(
  status: 'protected' | 'ambiguous',
  tagNames: string[],
  rootDocument: Document = document,
): void {
  let host = rootDocument.getElementById(PROTECTION_HOST_ID);
  if (host === null) {
    host = rootDocument.createElement('div');
    host.id = PROTECTION_HOST_ID;
    rootDocument.body.append(host);
  }
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  const label =
    status === 'protected'
      ? `Protected card${tagNames.length > 0 ? ` · ${tagNames.join(', ')}` : ''}`
      : 'Card identity needs review';
  const style = rootDocument.createElement('style');
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
  const badge = rootDocument.createElement('div');
  badge.setAttribute('role', 'status');
  badge.textContent = `FUT Copilot · ${label}`;
  shadow.replaceChildren(style, badge);
}
