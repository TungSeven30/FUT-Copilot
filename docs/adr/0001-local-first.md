# ADR 0001: Local-first persistence

- Status: accepted
- Date: 2026-08-01

## Decision

Use versioned IndexedDB storage through Dexie. No account or backend is required. A versioned JSON backup is the portability boundary.

## Why

This keeps the personal tool useful offline, limits credential and privacy exposure, and makes the data model easy to inspect while learning.

## Consequences

Cross-device synchronization and the iPhone companion are deferred. Schema migrations and export/import tests are mandatory.
