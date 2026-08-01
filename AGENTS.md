# Agent guide

## Purpose

Build a personal Chrome-first FUT copilot for SBC grinding, duplicate handling, and manual buying/selling. Optimize for understandable, testable work that teaches the owner how the system works.

## Hard safety boundaries

1. Never read, store, log, or transmit EA or FUT.GG passwords, cookies, access tokens, refresh tokens, or authenticated response bodies.
2. Never automate game-changing actions: buying, bidding, listing, submitting an SBC, opening a pack, discarding, quick-selling, or recovering an item.
3. Treat FUT.GG as a user-facing destination. Use deep links, user-entered observations, or an explicitly granted documented API only.
4. Keep data local by default. Network access must be declared, documented, and independently disableable.
5. Use synthetic or aggressively redacted fixtures only. Never commit captured raw EA page HTML.

## Architecture rules

- UI and recommendation code consume normalized domain events, never EA DOM selectors.
- EA selectors and page-shape heuristics belong only in `packages/ea-web-adapter`.
- Validate all persistence and import boundaries with Zod.
- Version the database schema, backup envelope, fixture schema, and adapter compatibility metadata.
- Import package subpaths directly; avoid broad barrel imports.
- Keep global browser listeners stable and clean them up when their owning context is invalidated.

## Required verification

Run `pnpm verify` before marking an implementation task complete. Update the compatibility log when any live EA selector or route assumption changes.

## Current milestone

Read `docs/backlog/current-milestone.md`. Complete one acceptance-tested slice at a time and update that file and `CHANGELOG.md` when the slice lands.
