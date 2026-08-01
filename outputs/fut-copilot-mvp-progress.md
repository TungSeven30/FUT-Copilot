# FUT Copilot MVP — Build Progress

Date: 2026-08-01
Current milestone: foundation complete; live observation next

## What is implemented

- A pnpm TypeScript monorepo on Git branch `main`.
- A WXT/React Chrome MV3 extension with a functional side panel.
- Chrome access limited to `storage`, `sidePanel`, and the exact official EA Ultimate Team Web App content-script path.
- `commands` correctly represented as a top-level manifest entry, not a permission.
- Runtime-validated models for profiles, card definitions, owned cards, protection rules, duplicates, SBCs, market history, recommendations, compatibility, and all normalized adapter events.
- Explicit observation states: known, inferred, unknown, and stale.
- Required explicit tradeability: tradeable, untradeable, or unknown.
- A 12-table, version-one Dexie/IndexedDB database.
- Versioned JSON backup export, validation preview, merge/replace import, imported-record-wins conflict behavior, and backup-before-replace.
- A deterministic EA screen fixture harness with timed DOM mutations.
- Eight synthetic fixture categories: selected card, active squad, pack result, player pick, duplicate, SBC, market, and unsupported.
- Automated fixture secret/account-data scanning.
- Automated verification of the final generated Chrome manifest.

The extension intentionally does not read live EA data yet. That boundary will be implemented only after a visible-UI observation session produces minimal, redacted evidence.

## Verification result

`pnpm verify` passes:

- Prettier formatting
- ESLint
- TypeScript checks across all workspaces
- 5 test files / 16 tests
- 8 fixture files passing redaction checks
- Chrome MV3 production build
- Generated permission and host allowlist
- No application-source remote-request primitives

Generated unpacked extension:

`apps/chrome-extension/.output/chrome-mv3/`

## How to run it

Prerequisites: Node.js 22 or newer and pnpm 11.

```bash
pnpm install
pnpm verify
pnpm dev
```

For the production build:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select `apps/chrome-extension/.output/chrome-mv3/`.
5. Click the FUT Copilot toolbar action; Chrome opens the side panel.

## Next implementation slice

FCP-008 through FCP-012 will establish the first useful vertical slice:

1. Observe only visible UI structure on the signed-in EA Web App.
2. Hand-author the smallest redacted fixture fragments needed for a selected card.
3. Record stable semantic anchors and deliberately treat fragile selectors as compatibility risks.
4. Implement screen classification, adapter health, and selected-card extraction.
5. Send a validated event to the side panel with distinct empty, loading, unsupported, degraded, and known states.

The live session should begin with a harmless club screen and one selected card. It must not capture HAR data, network responses, cookies, tokens, account identifiers, coin balance, raw full-page HTML, or game-changing actions.

## Safety boundary retained

The project still contains no automatic buy, bid, list, submit, open-pack, discard, quick-sell, or recovery action. FUT.GG remains a deep-link/manual-observation integration until a documented and explicitly authorized API exists.
