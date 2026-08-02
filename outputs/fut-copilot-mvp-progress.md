# FUT Copilot MVP — Build progress

Date: 2026-08-01

Current milestone: pack, player-pick, duplicate, and final manual live gates remain

## Implemented

- WXT/React Chrome MV3 side panel with only `storage` and `sidePanel` permissions.
- Exact official EA Ultimate Team Web App content-script match and no broad host permission.
- Runtime-validated card, profile, duplicate, SBC, market, recommendation, compatibility, and adapter-event contracts.
- Known, inferred, unknown, and stale observation states plus explicit tradeability.
- Twelve-table Dexie database schema v2 with tested version-1 migration.
- Validated schema-v2 JSON export/import, preview, merge/replace, and backup-before-replace.
- Eight synthetic/redacted fixture categories, eleven account-free fixture files,
  and a deterministic fixture harness.
- Live-tested English Club screen classifier and selected-card extractor.
- Live-tested English Active Squad extractor with ordered 11 / 7 / 5 player
  groups and manager exclusion.
- Live-tested English Transfer List detail extractor with ownership-safe local
  persistence and read-only displayed coin values.
- Live-tested English empty-SBC requirements extractor with mirrored-list and
  11 + 12 slot-shape agreement; populated SBC cards fail closed.
- Typed Chrome messaging and loading, empty, ready, unsupported, and degraded panel states.
- Local PlayStation profile, seven tags, protection rules, notes, and non-collapsing identity resolution.
- User-clicked FUT.GG exact-or-search links with no API, scraping, or background request.
- Keep, sell, and SBC recommendation models with editable weights, reasons,
  confidence, uncertainty, and protection override.
- Duplicate case creation/triage with identity provenance and bounded
  cross-runtime observation deduplication.
- A tested, non-interactive Shadow-DOM protection badge with explicit cleanup.
- Rating-only SBC planner with corrected correction-factor rounding, broad
  integer-reference coverage, duplicate cleanup, club preservation, and
  low-cost strategies.
- Manual market price/cost input, tax calculation, break-even, P/L, transaction journal, and selling guard.
- Settings/compatibility summary and installation, backup, rollback, privacy, limitations, and smoke-test documentation.

## Verification

`pnpm verify` runs formatting, ESLint, recursive TypeScript checks, Vitest,
fixture redaction, the Chrome production build, and generated permission/runtime
safety checks. The latest exact counts and bundle sizes are recorded after the
final release-gate verification run, not hand-maintained here.

Generated unpacked extension:

`apps/chrome-extension/.output/chrome-mv3/`

## Live support matrix

| Context | Contract/tests | Live adapter | Status |
| --- | --- | --- | --- |
| Club selected card | Yes | Yes | Live validated |
| Active squad/bench/reserves | Yes | Yes | Live validated |
| Pack result | Yes | No | User-created visible state required |
| Player pick | Yes | No | User-created visible state required |
| Duplicate | Yes | No | User-created visible state required |
| Empty SBC requirements | Yes | Yes | Live validated; exact-build panel confirmation pending |
| Populated SBC cards | Yes | No | User-created visible state required |
| Transfer List detail | Yes | Yes | Live validated |
| Transfer Market search results | Yes | No | Safe read-only observation required |

Unsupported live screens fail closed; synthetic coverage is never presented as
proof of EA DOM compatibility.

## Remaining release gates

1. Confirm the exact production side panel displays the live empty-SBC heading
   and both requirement labels.
2. Let the owner naturally create each pending pack-result, player-pick, and
   duplicate visible state manually.
3. Record only sanitized structural evidence, implement one extractor slice at
   a time, and add compatibility notes.
4. Safely observe Transfer Market search results if that screen remains in the
   accepted release scope.
5. Run every item in `docs/release/manual-smoke-checklist.md`.
6. Mark the draft PR ready only after all required gates pass or are explicitly
   waived by the owner.

## Safety boundary retained

There is no automatic buy, bid, list, submit, open-pack, select, discard,
quick-sell, or recovery action. The runtime does not capture EA or FUT.GG
credentials, cookies, tokens, raw authenticated responses, or raw page HTML.
