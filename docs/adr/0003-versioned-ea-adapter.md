# ADR 0003: Versioned EA adapter boundary

- Status: accepted
- Date: 2026-08-01

## Decision

Isolate EA Web App page-shape knowledge behind a versioned adapter that emits normalized, validated observations. Develop it against synthetic/redacted fixtures before live observation.

## Consequences

Selectors never enter storage, recommendation, or UI packages. Every live assumption needs compatibility evidence and a fixture. Unknown layouts yield an unsupported observation rather than guessed data.
