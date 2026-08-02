# FUT Copilot 0.1.0 MVP preview

This directory contains the operational handoff for the unpacked Chrome release.

- [Installation](installation.md)
- [Backup, upgrade, and rollback](upgrade-and-rollback.md)
- [Known limitations](known-limitations.md)
- [Manual smoke checklist](manual-smoke-checklist.md)
- [Verification record — 2026-08-01](verification-2026-08-01.md)
- [Privacy and permission audit](privacy-audit.md)

The production artifact is generated at
`apps/chrome-extension/.output/chrome-mv3/` by `pnpm verify` or `pnpm build`.
It is intentionally not committed because it is reproducible build output.

## Release status

The selected-card, Active Squad, Unassigned player pack/duplicate, read-only
Transfer List, Transfer Market Search Results, and empty SBC-requirements
workflows are live-validated against the English FC 26 Web App. Exact rebuilt
pack/duplicate behavior is owner-confirmed. Player pick, populated SBC cards,
and the remaining manual smoke checklist remain release gates. The manual
side-panel workspaces are usable without those pending live extractors.
