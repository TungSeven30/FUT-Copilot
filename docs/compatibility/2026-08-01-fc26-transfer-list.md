# FC 26 Transfer List compatibility

- Observation date: 2026-08-01
- Adapter version: `fc26-web-v0.3.0`
- Route family: official Ultimate Team Web App root
- Screen: populated Transfer List with one visible selected item detail
- Locale: English
- Web App build identifier: unknown
- Sanitized fixture: `transfer-list-live-contract`
- Result: supported as read-only context with explicit ownership and price
  interpretation boundaries

## Stable-enough anchors for this adapter

- `.ut-root-view h1.title` with the English **Transfer List** heading and one
  `.ut-transfer-list-view` classify the screen.
- `.ut-split-view.sidebar-right` scopes the visible list/detail layout.
- One `.DetailView .detail-carousel .tns-slide-active` identifies the currently
  selected detail slide.
- One direct `.item.player.ut-item-loaded` child identifies the selected loaded
  player card.
- `.name.main-view`, `.rating`, `.position`, `.item-view--player-stat`,
  `.statLabel`, and `.statValue` expose the same visible detailed-card facts as
  the supported Club detail view.
- One `.DetailPanel .transferPanel.auctionInfo` scopes transfer metadata.
- Numeric `.currency-coins.subContent` values inside that panel are preserved
  in visible order. Nonnumeric placeholders such as dashes are ignored rather
  than coerced to zero.

## Deliberately inferred or unknown facts

- Presence on the Transfer List implies the card is tradeable, but it does not
  prove the item is still owned. A newly created local copy therefore uses
  `ownershipStatus: unknown` and `location: transfer-list` until a later Club
  observation confirms ownership.
- Displayed coin values are not labeled as valuation, current market price,
  purchase price, or sale proceeds in the normalized event. The adapter keeps
  their visible order and does not silently save them as a market observation.
- Sold, expired, active, and other listing-state classes were observed but are
  not normalized until their semantics receive separate sanitized evidence.
- Club, league, nation, exact promotion, resource IDs, and the Web App build
  remain unknown.

## Fail-closed behavior

- Multiple detail views, multiple active cards, incomplete required card
  fields, concept cards, or a missing/ambiguous auction panel produce a degraded
  event.
- A recognized empty Transfer List without a detail view emits a known empty
  market context rather than a guessed card.
- The adapter never clicks **Re-list All**, trade options, or any other transfer
  control. It performs no search, bid, buy, listing, or clearing action.

## Compatibility risks

- The heading is locale-dependent.
- The carousel's `tns-slide-active` class and the split-view/detail hierarchy
  can change independently of the player-card fields.
- Currency formatting currently supports the observed English comma-separated
  integer form. Other locales must receive separate compatibility evidence.

No account header value, balance, player/card value, listing value, club
identity, raw HTML, cookie, token, header, image URL, or network response was
retained.
