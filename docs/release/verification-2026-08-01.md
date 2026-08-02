# Verification record — 2026-08-01

This record separates reproducible automated evidence from owner-assisted live
evidence. It contains no account identifier, balance, inventory value, raw EA
HTML, cookie, token, header, or authenticated response.

## Automated release evidence

`pnpm verify` passed from the repository root on 2026-08-01:

- Prettier and ESLint passed.
- TypeScript passed for domain, EA adapter, recommendation engine, storage, and
  Chrome extension workspaces.
- Vitest passed: **22 files, 81 tests**.
- Fixture redaction passed for **8 synthetic fixture files**.
- The Chrome MV3 production build completed at
  `apps/chrome-extension/.output/chrome-mv3/` (**694.92 kB** total).
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

## Owner-assisted live evidence

- Locale: English.
- EA Web App build identifier: not exposed reliably; recorded as unknown.
- Supported screen: **My Club Players**, single selected-card detail carousel.
- Result: the owner confirmed the selected visible name, rating, and position
  matched after reloading the unpacked extension.
- Compatibility record: `docs/compatibility/2026-08-01-fc26-club-selected-card.md`.

## Open live gates

Active squad/bench/reserves, pack result, player pick, duplicate, SBC, transfer
context, and the complete manual regression checklist remain open. During the
latest owner-assisted attempt, EA displayed an authentication-expired dialog on
the Squads hub. The dialog was left for the owner; FUT Copilot did not dismiss
it or perform a login action. Live validation resumes only after manual sign-in.
