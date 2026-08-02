# FC 26 Transfer Market Search Results compatibility

## Observation scope

- Date: 2026-08-01
- Locale: English
- Route family: Transfer Market Search Results
- State: populated result list with one selected visible result
- Adapter version: `fc26-web-v0.5.0`
- Sanitized fixture: `transfer-market-search-results-live-contract`
- Build identifier: not exposed reliably; recorded as unknown

The observation used one unfiltered read-only Search action. FUT Copilot did not
watch an item, make a bid, buy, compare, list, re-list, or clear a transfer
item. No player identity, result value, account identity, balance, credential,
cookie, token, authenticated response, or raw page HTML was retained.

## Stable visible anchors

- `.ut-root-view h1.title` contains the English **Search Results** heading.
- Exactly one `.ut-pinned-list-container.SearchResults` contains the result
  rows.
- Exactly one `.listFUTItem.has-auction-data.selected` identifies the selected
  visible result.
- Exactly one selected detailed card appears under
  `.ut-split-view.sidebar-right .DetailView .detail-carousel
.tns-slide-active` as a direct `.item.player.ut-item-loaded` child.
- Exactly one `.DetailPanel .auctionInfo` contains the visible auction detail.
- The visible start price is scoped to
  `.currentBid.column .currency-coins.subContent`.
- The visible read-only Buy Now label is scoped to one
  `button.buyButton.currency-coins`; the adapter reads its label but never
  activates it.

## Normalized output and ownership boundary

- The selected detailed card uses the shared visible name, rating, position,
  face-stat, and broad card-state parser.
- Presence in Search Results infers tradeability, with evidence
  `visible-transfer-market-context`.
- The start and Buy Now values are emitted as ordered, labeled observations.
- The normalized event is retained for adapter diagnostics, but no local owned
  card is created or updated from a market result. A later Club observation is
  required before the identity can become owned-card context or SBC inventory.
- Values are read-only context and are not silently saved as market
  observations or transactions.

## Fail-closed cases

The adapter degrades instead of emitting market context when:

- the Search Results heading/view boundary changes;
- the selected result row is missing or ambiguous;
- the selected detailed card is missing, incomplete, or ambiguous;
- the auction panel or Buy Now label is missing or ambiguous; or
- either displayed coin value is nonnumeric.

No selector is used to activate Watch, Bid, Buy Now, Compare Price, or any other
market action.
