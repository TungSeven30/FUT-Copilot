# FUT Copilot MVP — Build progress

Date: 2026-08-01

Current milestone: player-pick and final manual live gates remain

## Implemented

- WXT/React Chrome MV3 side panel with only `storage` and `sidePanel` permissions.
- Exact official EA Ultimate Team Web App content-script match and no broad host permission.
- Runtime-validated card, profile, duplicate, SBC, market, recommendation, compatibility, and adapter-event contracts.
- Known, inferred, unknown, and stale observation states plus explicit tradeability.
- Twelve-table Dexie database schema v2 with tested version-1 migration.
- Validated schema-v2 JSON export/import, preview, merge/replace, and backup-before-replace.
- Eight synthetic/redacted fixture categories, fourteen account-free fixture files,
  and a deterministic fixture harness.
- Live-tested English Club screen classifier and selected-card extractor.
- Live-tested English Active Squad extractor with ordered 11 / 7 / 5 player
  groups and manager exclusion.
- Live-tested English Transfer List detail extractor with ownership-safe local
  persistence and read-only displayed coin values.
- Live-tested English empty-SBC requirements extractor with mirrored-list and
  11 + 12 slot-shape agreement.
- Live-tested English populated SBC-builder extractor with pitch-before-work-
  area order, compact rating/position facts, and deliberately unknown names.
- Live-tested English Transfer Market Search Results extractor with a selected
  detail card, labeled start/Buy Now values, and no owned-card mutation.
- Live-tested English Unassigned player pack-result extractor preserves ordered
  Items and Duplicates sections and creates idempotent local duplicate cases.
- Read-only normalized player-pick summaries are implemented and tested; their
  live EA selectors remain gated.
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
| Pack result | Yes | Yes | Live + exact-build panel validated |
| Player pick | Yes | No | User-created visible state required |
| Duplicate | Yes | Yes | Live + repeated-observation idempotency validated |
| Empty SBC requirements | Yes | Yes | Live + exact-build panel validated |
| Populated SBC cards | Yes | Yes | Live + exact-build panel validated |
| Transfer List detail | Yes | Yes | Live validated |
| Transfer Market search results | Yes | Yes | Live + exact-build panel validated |

Unsupported live screens fail closed; synthetic coverage is never presented as
proof of EA DOM compatibility.

## Remaining release gates

1. Let the owner naturally create the pending player-pick state manually.
2. Record only sanitized structural evidence, implement the extractor slice,
   and add compatibility notes.
3. Run every item in `docs/release/manual-smoke-checklist.md`.
4. Mark the draft PR ready only after all required gates pass or are explicitly
   waived by the owner.

## Safety boundary retained

There is no automatic buy, bid, list, submit, open-pack, select, discard,
quick-sell, or recovery action. The runtime does not capture EA or FUT.GG
credentials, cookies, tokens, raw authenticated responses, or raw page HTML.
