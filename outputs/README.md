# FUT Co-Pilot Project Documents

## Current direction

Chrome-first, local-first Ultimate Team helper focused on:

1. Pack and player-pick decisions
2. Duplicate triage and SBC grinding
3. Manual buying and selling support

The product calculates, guides, and warns. The user performs all game-changing actions.

## Documents

- [MVP implementation plan](./fut-copilot-mvp-implementation-plan.md) — exact MVP scope, technical decisions, package boundaries, 32 ordered work items, test matrix, manual QA, estimates, implementation gates, and release criteria.
- [Personalized product and implementation specification](./fut-copilot-personalized-spec.md) — current source of truth for scope, workflows, architecture, agent rules, milestones, and acceptance criteria.
- [Research and implementation framework](./fut-helper-research-framework.md) — background research on the EA Web App, FUT.GG, FC Enhancer, policy boundaries, and the original solution framework.

## Current milestone

Next: implement FCP-001 through FCP-007 from the MVP implementation plan:

- AI-agent-friendly monorepo and documentation
- Chrome Manifest V3 extension shell
- Minimal permission baseline and validator
- Domain schemas and local Dexie database
- Backup export/import
- EA fixture harness

After that foundation, complete the user-assisted Web App observation task before writing real selectors.
