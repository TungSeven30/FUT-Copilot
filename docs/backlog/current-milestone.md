# Current milestone: live workflow adapter gates

## Completed foundation and local workflows

- [x] Workspace, Chrome side-panel shell, safety policy, and narrow permissions.
- [x] Versioned domain events, IndexedDB schema v2 migration, and backup/import.
- [x] Deterministic synthetic fixtures and account-data redaction checks.
- [x] Live English FC 26 Club screen classification and selected-card extraction.
- [x] Typed content/background/panel messages and fail-closed adapter health.
- [x] Default PlayStation profile, seven personal tags, protection, and notes.
- [x] Ambiguity-safe local identity resolution and user-clicked FUT.GG links.
- [x] Explainable keep, sell, and SBC recommendations.
- [x] Duplicate case persistence/triage and non-interactive protection warning.
- [x] Rating-only SBC planner with protected-card exclusions and validation.
- [x] Manual market observations, tax calculator, selling guard, and journal.
- [x] Settings, compatibility summary, schema-v2 export/import, and release docs.
- [x] Editable recommendation weights and favorite-player/club scoring.
- [x] Duplicate destination selection plus explicit user-confirmed resolution log.
- [x] Fail-closed visible-SBC protection scan against resolved local identities.
- [x] Selected-card concept, loan, Evolution-rarity, incomplete, and ambiguity regressions.
- [x] Export/import regression with one validated record in every schema-v2 table.
- [x] Corrected SBC rating boundaries with integer-reference matrix coverage.
- [x] Fail-closed SBC label parser for constrained or unknown requirements.
- [x] Interactive side-panel shell and isolated Shadow-DOM badge regressions.
- [x] Tag, note, and protection persistence across a database close/reopen.
- [x] Duplicate identity provenance and bounded cross-runtime event deduplication.

## Active release gates

- [ ] Live-observe active squad, bench, and reserves; add sanitized compatibility
      evidence before implementing selectors.
- [ ] Live-observe pack result and player-pick layouts without opening a pack or
      making a pick on the user's behalf.
- [ ] Live-observe duplicate state and prove idempotent local case creation.
- [ ] Live-observe an SBC segment and implement supported requirement extraction.
- [ ] Live-observe read-only transfer context without searching, bidding, buying,
      or listing on the user's behalf.
- [ ] Run the complete manual smoke checklist on the supported EA build.

## Acceptance target

Each new live extractor must emit only normalized domain events, preserve visible
order/grouping, fail closed on ambiguity, use a synthetic or aggressively
redacted fixture, and receive a compatibility-log entry. No raw HTML or account
data may be stored. All game-changing actions remain manual.

The owner-assisted Chrome connection was restored on 2026-08-01 and reached the
EA Squads hub. An EA authentication-expired dialog prevented navigation to the
active squad. FUT Copilot did not dismiss the dialog, trigger login, or retain
any account value. No new selector assumption was promoted from that session;
live work resumes only after the owner signs in manually.
