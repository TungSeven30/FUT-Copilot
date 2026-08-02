# Manual smoke checklist

Record the date, Chrome version, EA Web App locale/build if visible, extension
commit, and tester. Never paste account identifiers, balances, card collections,
or raw page HTML into this file.

## Automated prerequisite

- [x] `pnpm verify` passes. Evidence: 2026-08-01 verification record.
- [x] `apps/chrome-extension/.output/chrome-mv3/manifest.json` exists.
- [x] Generated permissions are exactly `storage` and `sidePanel`.

## Extension shell

- [ ] Load the unpacked production directory without Chrome errors.
- [ ] Toolbar action opens the side panel.
- [ ] Context, duplicates, SBC, market, and settings tabs render.
- [ ] The manual-action safety boundary is visible.

## Live selected-card slice

- [ ] On English **My Club Players** with no detail carousel, panel shows empty.
- [x] Selecting one card produces the matching visible name/rating/position.
      Owner-assisted English Club observation confirmed “matches” on
      2026-08-01; no account values were retained.
- [ ] Tags and notes persist after extension reload.
- [ ] A protecting tag creates a non-interactive Shadow DOM warning.
- [ ] Leaving the supported context removes the warning or shows unsupported.
- [ ] A deliberately missing/ambiguous anchor degrades instead of emitting a
      guessed card.

## Local workspaces

- [ ] Manual price plus purchase price produce expected net, break-even, and
      estimated P/L.
- [ ] Protected/list-below-minimum warnings appear before a journal listing.
- [ ] Transaction journal keeps estimated and realized P/L separate.
- [ ] Duplicate queue has no automatic or default quick-sell action.
- [ ] Rating-only SBC proposal excludes protected cards and validates locally.
- [ ] Unsupported SBC requirements prevent a valid label.

## Portability

- [ ] Export a populated schema-v2 backup.
- [ ] Preview and merge it into a clean test profile/database.
- [ ] Replace import downloads a prior backup first.
- [ ] Invalid and future-version backups are rejected before writes.

## Pending live adapter gates

- [x] Active squad, bench, and reserves validated as distinct. Owner-assisted
      read-only observation confirmed the 11 + manager / 7 / 5 shape on
      2026-08-01; no account or player values were retained.
- [ ] Pack result preserves visible card order.
- [ ] Player pick preserves option order and never selects.
- [ ] Visible duplicate creates one idempotent local case.
- [ ] Visible SBC requirements label unsupported constraints.
- [x] Visible Transfer List context reads one selected card and scoped coin
      values without performing a market action. Owner-assisted read-only
      observation confirmed the live structure on 2026-08-01; no listing or
      account values were retained.
