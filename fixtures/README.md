# Synthetic EA Web App fixtures

These fixtures are hand-authored simulations, not captured EA pages. They exist to exercise route/screen transitions without an account or live service.

Required categories are selected card, active squad, pack result, player pick, duplicate, SBC, market, and unsupported. Fixture mutations use deterministic virtual milliseconds; no real timers or network calls are involved.

Before committing a fixture, run `pnpm verify:fixtures`. Live observation work must remove all account identifiers and retain only the smallest structure required by a test.
