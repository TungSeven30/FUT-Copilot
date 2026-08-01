# MVP scope

## Primary user

One PlayStation FUT player using the EA Web App in Chrome. The same person owns the source code, local data, decisions, and all in-game actions.

## Jobs to be done

1. Reduce duplicate-item friction after opening a pack or player pick.
2. Understand which owned items are sensible SBC inputs without sacrificing favorites, active squad pieces, valuable Evolutions, or high-value market items.
3. Record manual purchase/listing observations and make calmer buy/sell decisions.
4. Open the correct FUT.GG player page quickly for richer card, Evolution, and market research.

## MVP capabilities

- Chrome side panel that recognizes supported EA Web App contexts.
- User-assisted observation of selected cards, SBC squads, duplicates, and transfer-list rows.
- Local player preferences and protected-item rules.
- Explainable duplicate and SBC recommendations; never automatic actions.
- Manual market observations with freshness and PlayStation provenance.
- FUT.GG deep links; no assumed private API.
- JSON export, validation preview, merge/replace import, and backup before replacement.

## Explicit non-goals

- Automatic full-club synchronization.
- Automatic buying, bidding, listing, SBC submission, pack opening, discarding, or quick-selling.
- Capturing credentials, cookies, tokens, or authenticated network payloads.
- FUT.GG scraping or reverse-engineering private endpoints.
- Chemistry or optimal squad solver in the first MVP.
- iPhone, cloud synchronization, social/community features, or multi-user accounts.

## Initial success measures

- A duplicate can be classified and given a user-confirmed next-step recommendation in under 15 seconds.
- A selected card can be matched to a local identity or marked ambiguous without silently choosing the wrong item.
- An exported backup can be previewed and restored without losing schema/provenance information.
- The generated extension manifest passes the permission allowlist automatically.
