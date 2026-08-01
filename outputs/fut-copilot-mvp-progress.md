# FUT Copilot MVP — Build Progress

Date: 2026-08-01
Current milestone: selected-card observation complete; personalization next

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
- Sanitized live compatibility evidence for the FC 26 English Club screen.
- A versioned Club screen classifier and selected-card extractor.
- Typed Chrome messages and a manual **Observe selected card** gesture.
- Side-panel loading, empty, ready, unsupported, and degraded states.
- Live smoke-test confirmation against a selected visible card.

The extension now reads the selected visible Club card's name, overall, position, face statistics, broad rarity family, and carefully inferred first-owner, loan, and transfer signals. It does not yet resolve an exact card identity, synchronize the full club, or generate recommendations.

## Verification result

`pnpm verify` passes:

- Prettier formatting
- ESLint
- TypeScript checks across all workspaces
- 7 test files / 21 tests
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

FCP-013 through FCP-016 will personalize the selected-card context:

1. Create the default local PlayStation profile.
2. Add persistent personal tags, protection, and notes.
3. Resolve exact or ambiguous card identity explicitly.
4. Open exact-or-search FUT.GG public deep links.
5. Add a manual PlayStation market calculator.

## Safety boundary retained

The project still contains no automatic buy, bid, list, submit, open-pack, discard, quick-sell, or recovery action. FUT.GG remains a deep-link/manual-observation integration until a documented and explicitly authorized API exists.
