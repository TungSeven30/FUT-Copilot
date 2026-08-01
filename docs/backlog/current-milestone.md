# Current milestone: foundation and observation boundary

## In this slice

- [x] Workspace and Chrome side-panel scaffold.
- [x] Safety, architecture, source, and agent documentation.
- [x] Narrow generated-manifest permission verifier.
- [x] Runtime-validated domain and observation contracts.
- [x] Versioned local storage and backup/import implementation.
- [x] Deterministic fixture harness and fixture redaction verifier.
- [ ] User-assisted selected-card observation against a user-provided redacted fixture.

## Next acceptance target

With the extension loaded on the EA Web App and a card selected, an explicit **Observe selected card** gesture emits either:

- a validated normalized card observation with provenance and confidence, or
- a validated ambiguous/unsupported observation with a useful reason.

No raw HTML or secret material may cross the adapter boundary. All new page-shape assumptions require a synthetic/redacted fixture and compatibility note.
