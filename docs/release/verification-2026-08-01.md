# Verification record — 2026-08-01

This record separates reproducible automated evidence from owner-assisted live
evidence. It contains no account identifier, balance, inventory value, raw EA
HTML, cookie, token, header, or authenticated response.

## Automated release evidence

`pnpm verify` passed from the repository root on 2026-08-01:

- Prettier and ESLint passed.
- TypeScript passed for domain, EA adapter, recommendation engine, storage, and
  Chrome extension workspaces.
- Vitest passed: **28 files, 131 tests**.
- Fixture redaction passed for **13 synthetic fixture files**.
- The Chrome MV3 production build completed at
  `apps/chrome-extension/.output/chrome-mv3/` (**727.1 kB** total).
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
- The live Transfer List contract scopes one selected detailed card and numeric
  auction-panel coin values, ignores nonnumeric placeholders, supports an empty
  list, and fails closed on active-card or panel ambiguity.
- A newly observed Transfer List card is locally unknown-owned and excluded
  from SBC inventory until a Club observation confirms ownership.
- The live empty-SBC contract requires matching duplicated requirement lists,
  preserves visible requirement order, validates 11 pitch plus 12 work-area
  slots, and degrades when any card is populated or the structure changes.
- The observed Bronze-only requirement is displayed but rejected by the
  rating-only planner, while its one-player count remains understood.
- The live Transfer Market contract scopes one selected result/detail card and
  separately labels the visible start and Buy Now values. It does not create or
  update local owned-card context.
- Client-rendered summaries preserve normalized pack and player-pick order,
  expose duplicate triage status, include no game-action controls, and reject a
  player-pick selection index outside the visible option list.
- The live Unassigned contract preserves Items followed by Duplicates, marks
  duplicate indexes, leaves row tradeability unknown, and fails closed on
  unloaded, incomplete, unknown-section, or concept rows.
- Persistence finds any matching recent same-type observation rather than only
  the newest one, keeping several distinct pack duplicates independently
  idempotent across repeated observation.
- GitHub Actions independently passes the same complete `pnpm verify` release
  pipeline on the draft pull request.

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
- Supported screen: **Transfer List**, with one selected detailed card and
  scoped displayed coin values.
- Result: sanitized read-only structural observation matched the extractor
  contract without clicking re-list, search, bid, buy, listing, or clearing
  controls.
- Compatibility record: `docs/compatibility/2026-08-01-fc26-transfer-list.md`.
- Supported screen: **SBC challenge detail**, with an empty squad and mirrored
  visible requirement lists.
- Result: sanitized read-only structural observation matched the extractor
  contract without using Squad Builder, placing cards, clearing, submitting,
  exchanging, or claiming. On 2026-08-02, the owner confirmed the reloaded
  production side panel matched the challenge name, both ordered requirement
  labels, and zero loaded player cards.
- Compatibility record: `docs/compatibility/2026-08-01-fc26-sbc-requirements.md`.
- Supported screen: **Transfer Market Search Results**, with one selected
  visible result and detailed card.
- Result: one unfiltered read-only search confirmed the selected-result,
  detail-card, start-price, and Buy Now label boundaries without activating
  Watch, Bid, Buy, Compare, list, or re-list. On 2026-08-02, the owner confirmed
  the reloaded production side panel matched the selected card, **Start price**,
  and **Buy Now price** presentation.
- Compatibility record:
  `docs/compatibility/2026-08-01-fc26-transfer-market-search-results.md`.
- Supported screen: **Unassigned**, with ordered player Items and Duplicates
  sections after the owner opened a pack manually.
- Result: sanitized read-only structure confirmed one loaded compact player per
  row and separate ordered result sections without activating send, list,
  compare, discard, quick-sell, or result-advance controls. The rebuilt exact
  production side-panel summary remains to be owner-confirmed.
- Compatibility record:
  `docs/compatibility/2026-08-02-fc26-pack-result-duplicates.md`.

## Open live gates

Exact-build pack/duplicate panel confirmation, player pick, populated SBC-card
handling, and the complete manual regression checklist remain open. Pending
screens require owner-assisted, naturally reached visible states; FUT Copilot
will not open a pack, select a pick, place or submit an SBC card,
search/bid/buy, list, discard, or quick-sell for the owner.
