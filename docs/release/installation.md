# Install the unpacked Chrome extension

## Requirements

- Chrome 114 or newer
- Node.js 22 or newer
- pnpm 11

## Build and load

From the repository root:

```bash
pnpm install
pnpm verify
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the absolute `apps/chrome-extension/.output/chrome-mv3/` directory.
5. Open the official EA Ultimate Team Web App.
6. Use the FUT Copilot toolbar button or `Command+Shift+U` on macOS
   (`Ctrl+Shift+U` elsewhere) to open the side panel.

After rebuilding, use the extension card's **Reload** button. If Chrome reports
that the manifest cannot be read, confirm that `pnpm build` completed and that
the selected directory itself contains `manifest.json`.

## Permission check

Version 0.1.0 requests only `storage` and `sidePanel`. Its only page match is:

```text
https://www.ea.com/ea-sports-fc/ultimate-team/web-app/*
```

It declares no `host_permissions`, FUT.GG permission, OAuth configuration,
remote requests, analytics, or telemetry.
