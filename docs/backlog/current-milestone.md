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

The Chrome browser-control connection timed out twice on 2026-08-01 while
claiming the already-open EA tab. No new selector assumption was recorded from
that failed session.
