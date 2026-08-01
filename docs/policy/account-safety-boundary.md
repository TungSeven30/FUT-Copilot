# Account safety boundary

This project is an informational copilot, not a game-playing bot.

## Allowed

- Read user-visible page state after an explicit user gesture or while a supported screen is open.
- Normalize a minimal set of visible facts such as card name, rating, position, trade status, and displayed price.
- Store normalized facts locally with provenance, confidence, and timestamps.
- Recommend and explain actions for the user to perform manually.
- Deep-link to public FUT.GG pages.

## Prohibited

- Password, passkey, session cookie, access token, refresh token, authorization header, or CSRF-token collection.
- Storage of raw authenticated requests/responses, raw page HTML, or full browser-history data.
- Automatic clicks or requests that buy, bid, list, submit, open, discard, quick-sell, or recover items.
- Rate-limit bypass, anti-bot bypass, CAPTCHA handling, undocumented FUT.GG endpoint access, or credential replay.

## Review trigger

Any feature requiring a new permission, host, network request, injected page-world script, or write action must receive a new ADR and a user review before implementation.
