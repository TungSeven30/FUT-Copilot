# Privacy and permission audit

Audit date: 2026-08-01

Release candidate: 0.1.0 MVP preview

## Data flow

The content script reads the currently rendered EA Web App document and emits a
small Zod-validated normalized event. DOM nodes and raw HTML never cross the
adapter boundary. The background stores normalized events and derived local
records in IndexedDB. The side panel reads those records to calculate and
explain recommendations.

FUT.GG is a user-initiated external link only. The runtime contains no `fetch`,
`XMLHttpRequest`, or `WebSocket` call.

## Stored data inventory

- Local profile preferences and recommendation weights
- Normalized card facts and owned-card context
- Personal tags, notes, and protection rules
- Normalized adapter observations
- User-confirmed duplicate, SBC proposal, price, and transaction records
- Sanitized compatibility metadata

Explicitly excluded: passwords, passkeys, cookies, tokens, authorization
headers, raw authenticated responses, raw page HTML, account identifiers,
analytics, and telemetry.

## Automated evidence

`pnpm verify` enforces:

- fixture secret/account-pattern redaction;
- exact generated manifest permissions and one EA content-script match;
- absence of host permissions, OAuth, and external connections;
- absence of runtime remote-request primitives and dynamic/remote executable
  code across extension and package sources;
- absence of programmatic page-control activation in the content and background
  entrypoints;
- Zod validation of persistence/import boundaries;
- stripping of unknown sensitive-shaped fields from JSON exports;
- production build, types, lint, formatting, and tests.

## Manual audit result

- No credential or session access code is present.
- No Chrome cookie, debugger, tabs, history, proxy, request-interception, or
  broad host permission is requested.
- No network access or telemetry is implemented.
- The only programmatic click is on a side-panel-created download anchor for an
  explicit local backup; no EA control is activated.
- Every buy, bid, list, SBC submit, pack open, pick, discard, quick-sell, or
  recovery action remains outside the extension.

## Residual risk

EA can change its DOM. The live adapter therefore fails closed and must be
revalidated with sanitized evidence. Local exports can contain the user's own
notes and FUT records; the user controls where those downloaded JSON files are
stored or shared.
