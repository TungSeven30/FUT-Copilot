# FUT Copilot MVP — Build progress

Date: 2026-08-01

Current milestone: local MVP workspaces complete; live workflow adapter gates remain

## Implemented

- WXT/React Chrome MV3 side panel with only `storage` and `sidePanel` permissions.
- Exact official EA Ultimate Team Web App content-script match and no broad host permission.
- Runtime-validated card, profile, duplicate, SBC, market, recommendation, compatibility, and adapter-event contracts.
- Known, inferred, unknown, and stale observation states plus explicit tradeability.
- Twelve-table Dexie database schema v2 with tested version-1 migration.
- Validated schema-v2 JSON export/import, preview, merge/replace, and backup-before-replace.
- Eight synthetic/redacted fixture categories and a deterministic fixture harness.
- Live-tested English Club screen classifier and selected-card extractor.
- Typed Chrome messaging and loading, empty, ready, unsupported, and degraded panel states.
- Local PlayStation profile, seven tags, protection rules, notes, and non-collapsing identity resolution.
- User-clicked FUT.GG exact-or-search links with no API, scraping, or background request.
- Keep, sell, and SBC recommendation models with reasons, confidence, uncertainty, and protection override.
- Duplicate case creation/triage and a non-interactive on-page protection badge.
- Rating-only SBC planner with duplicate cleanup, club preservation, and low-cost strategies.
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
| Active squad/bench/reserves | Yes | No | User-assisted observation required |
| Pack result | Yes | No | User-created visible state required |
| Player pick | Yes | No | User-created visible state required |
| Duplicate | Yes | No | User-created visible state required |
| SBC segment | Yes | No | Safe live navigation/observation required |
| Transfer context | Yes | No | Safe read-only observation required |

Unsupported live screens fail closed; synthetic coverage is never presented as
proof of EA DOM compatibility.

## Remaining release gates

1. Restore a stable Chrome-control connection to the signed-in EA tab.
2. Let the user create or navigate to each pending visible state manually.
3. Record only sanitized structural evidence, implement one extractor slice at a time, and add compatibility notes.
4. Run every item in `docs/release/manual-smoke-checklist.md`.
5. Mark the draft PR ready only after all required gates pass or are explicitly waived by the owner.

## Safety boundary retained

There is no automatic buy, bid, list, submit, open-pack, select, discard,
quick-sell, or recovery action. The runtime does not capture EA or FUT.GG
credentials, cookies, tokens, raw authenticated responses, or raw page HTML.
