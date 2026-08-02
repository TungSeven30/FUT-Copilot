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
- [x] Pack result preserves visible card order. Sanitized structure and the
      exact rebuilt production summary were owner-confirmed on 2026-08-02.
- [ ] Player pick preserves option order and never selects.
- [x] Visible duplicate creates one idempotent local case. After the live
      Duplicates section was observed, the owner repeated the read-only
      observation and confirmed the unresolved case count did not increase.
- [x] Visible SBC requirements label unsupported constraints. The owner
      confirmed the reloaded production panel matched the challenge name, both
      ordered requirement labels, and zero loaded player cards on 2026-08-02.
- [x] One owner-populated SBC slot exposes compact rating/position facts while
      its unproven identity stays unknown. Sanitized read-only observation on
      2026-08-02 retained no player or account value and performed no SBC
      action. The owner then confirmed the rebuilt panel matched the one loaded
      card, unknown-name boundary, visible rating/position, ordered
      requirements, and adapter `fc26-web-v0.7.0`.
- [x] Visible Transfer List context reads one selected card and scoped coin
      values without performing a market action. Owner-assisted read-only
      observation confirmed the live structure on 2026-08-01; no listing or
      account values were retained.
- [x] Transfer Market Search Results reads one selected detailed card plus the
      labeled start and Buy Now values in the exact production side panel. The
      owner confirmed the reloaded production panel matched on 2026-08-02. The
      live structure was observed with one read-only search; no Watch, Bid, Buy,
      Compare, list, or re-list action was performed, and no result or account
      value was retained.
