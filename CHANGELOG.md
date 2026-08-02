# Changelog

## Unreleased

### Added

- WXT/React Chrome side-panel scaffold with narrowly scoped EA Web App access.
- Runtime-validated FUT domain contracts and normalized observation events.
- Versioned Dexie database plus previewable export/import flows.
- Deterministic, synthetic EA-page fixture harness and safety validators.
- Sanitized FC 26 Club-screen compatibility evidence and selected-card fixture.
- Live Club screen classification and selected-card extraction with explicit uncertainty.
- Typed Chrome message pipeline and side-panel loading, empty, ready, unsupported, and degraded states.
- Manual **Observe visible context** gesture with normalized local snapshot caching.
- Default local PlayStation profile with seven personal tags, notes, and protection rules.
- Ambiguity-safe card identity resolution and user-clicked FUT.GG exact-or-search links.
- Explainable keep, sell, and SBC recommendation models with protection overrides.
- Duplicate case persistence and triage, plus a non-interactive Shadow DOM protection badge.
- Rating-only SBC planner with three strategies, protected-card exclusion, and independent validation.
- Manual market observations, tax/break-even calculator, transaction journal, and selling guard.
- Five-workspace side panel with local settings, compatibility health, and data portability.
- IndexedDB and backup schema version 2 with explicit version-1 migration.
- Synthetic active-squad, pack, pick, duplicate, SBC, and market workflow regression coverage.
- Release installation, backup/rollback, limitations, smoke-test, and privacy-audit guides.
- Editable personalization weights wired into favorite, meta, Evolution,
  market-value, and SBC-utility scoring.
- Explicit duplicate destination and user-confirmed resolution logging with
  protected-card warnings and no automatic quick-sell path.
- Visible-SBC local identity/protection scanning that blocks unresolved or
  protected proposals.
- Selected-card regressions for concept, loan, unrecognized Evolution rarity,
  incomplete fields, and ambiguous active-card anchors.
- Full schema-v2 backup round-trip coverage across all twelve local tables.
- Live English active-squad extraction with ordered starting XI, substitutes,
  reserves, manager exclusion, empty-slot preservation, and a side-panel squad
  summary.
- Sanitized active-squad compatibility evidence and an account-free live-contract
  fixture covering partial-field and structural ambiguity behavior.
- A least-privilege GitHub Actions gate that runs the complete `pnpm verify`
  release pipeline for pull requests and the main branch.
- Live English Transfer List extraction with one selected detailed card,
  read-only displayed coin values, known empty-list handling, and a side-panel
  context summary.
- Ownership-safe Transfer List persistence: newly observed listings remain
  `ownershipStatus: unknown` until a later Club observation confirms ownership.
- Live English empty-SBC extraction with one challenge heading, mirrored
  requirement-list agreement, 11 pitch plus 12 work-area slot validation, and
  fail-closed handling for populated or structurally changed squads.
- A read-only SBC context summary that exposes visible requirements while
  preserving the planner block on unsupported constraints.

### Fixed

- GitHub verification now uses the current Node 24-based checkout, pnpm setup,
  and Node setup action majors instead of deprecated Node 20 action runtimes.
- Market journal summaries now keep the newest target and listing from newest-first history.
- Rating-only SBC calculations now round the correction-adjusted total before
  dividing by squad size, fixing valid top-heavy combinations at rating
  boundaries.
- SBC requirement parsing now accepts only complete known rating/player-count
  labels, preventing constrained-player or unknown requirements from being
  silently reinterpreted or ignored.
- The on-page protection badge is isolated behind a tested Shadow-DOM module
  with idempotent updates, pointer-event isolation, and explicit cleanup.
- Duplicate triage rows now distinguish EA-visible stable identity from local
  composite inference or unresolved identity.
- Normalized observations now deduplicate at the IndexedDB boundary across
  extension restarts, updating timestamps while preserving real state changes
  and duplicate-case idempotency.

### Known limitations

- Live EA extraction supports the English Club selected-card, Active Squad,
  Transfer List, and empty SBC-requirements contexts. Pack result, player pick,
  duplicate, and populated SBC-card contracts remain synthetic-only until
  user-assisted validation produces sanitized compatibility evidence.
