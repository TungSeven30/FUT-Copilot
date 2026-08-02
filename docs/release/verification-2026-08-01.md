# Verification record — 2026-08-01

This record separates reproducible automated evidence from owner-assisted live
evidence. It contains no account identifier, balance, inventory value, raw EA
HTML, cookie, token, header, or authenticated response.

## Automated release evidence

`pnpm verify` passed from the repository root on 2026-08-01:

- Prettier and ESLint passed.
- TypeScript passed for domain, EA adapter, recommendation engine, storage, and
  Chrome extension workspaces.
- Vitest passed: **24 files, 91 tests**.
- Fixture redaction passed for **9 synthetic fixture files**.
- The Chrome MV3 production build completed at
  `apps/chrome-extension/.output/chrome-mv3/` (**701.47 kB** total).
- The generated manifest declared exactly `storage` and `sidePanel` permissions.
- The production artifact contained no programmatic background/content route
  activation, runtime network path, or dynamic-code escape rejected by the
  permission verifier.

Focused regression evidence includes:

- Favorite-player, favorite-club, meta, Evolution, market-value, and SBC-utility
  weights affect explainable recommendations.
- Duplicate cases move through destination selection and explicit
  user-confirmed local resolution; quick-sell is never the default.
- Visible SBC cards fail closed when local identity is unresolved or a matching
  owned copy is protected.
- Concept, loan, unrecognized Evolution rarity, incomplete fields, and multiple
  active-card anchors are handled conservatively.
- A populated schema-v2 backup round-trips one validated record from each of all
  twelve persisted tables.
- The SBC rating implementation matches an independent integer reference across
  every two-rating, eleven-player combination from 40 through 99, including
  public FC 26 boundary examples.
- Client-rendered side-panel tests exercise the disconnected state, all five
  workspace tabs, and fail-closed observation errors.
- Shadow-DOM badge tests prove one non-interactive status, idempotent updates,
  and cleanup when the owning context disappears.
- Persistence-level event signatures ignore generated IDs/timestamps, update a
  repeated observation inside a five-minute stability window after a runtime
  restart, preserve later occurrences, and keep duplicate case creation
  idempotent.
- The live active-squad contract emits exactly 11 starting slots, 7 substitute
  slots, and 5 reserve slots while excluding the manager, preserving empty
  slots, and degrading on a partially loaded or structurally ambiguous card.
- The client-rendered side panel summarizes normalized squad groups and exposes
  the unknown-name boundary instead of matching through images or hidden data.

## Owner-assisted live evidence

- Locale: English.
- EA Web App build identifier: not exposed reliably; recorded as unknown.
- Supported screen: **My Club Players**, single selected-card detail carousel.
- Result: the owner confirmed the selected visible name, rating, and position
  matched after reloading the unpacked extension.
- Compatibility record: `docs/compatibility/2026-08-01-fc26-club-selected-card.md`.
- Supported screen: **Active Squad**, with 11 starting player slots, one
  manager slot, 7 substitutes, and 5 reserves.
- Result: sanitized read-only structural observation confirmed visible rating,
  position, broad card-state markers, and the absence of accessible player-name
  text on small squad cards.
- Compatibility record: `docs/compatibility/2026-08-01-fc26-active-squad.md`.

## Open live gates

Pack result, player pick, duplicate, SBC, transfer context, and the complete
manual regression checklist remain open. These screens require owner-assisted,
naturally reached visible states; FUT Copilot will not open a pack, select a
pick, submit an SBC, search/bid/buy, list, discard, or quick-sell for the owner.
