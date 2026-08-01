# FC 26 Club selected-card compatibility

- Observation date: 2026-08-01
- Adapter version: `fc26-web-v0.1.0`
- Route family: official Ultimate Team Web App root
- Screen: Club player list with detail carousel
- Locale: English
- Web App build identifier: unknown
- Sanitized fixture: `selected-card-basic`
- Result: supported with explicit inference boundaries

## Stable-enough anchors for the first adapter

- `.ut-root-view h1.title` with the localized Club heading classifies the screen.
- `.DetailView` identifies the visible detail experience.
- `.detail-carousel .tns-slide-active` identifies the current carousel slide.
- `.item.player.ut-item-loaded` identifies a loaded player item inside that slide.
- `.name.main-view`, `.rating`, and `.position` expose core visible card fields.
- `.item-view--player-stat`, `.statLabel`, and `.statValue` expose the six face statistics.
- `.DetailPanel` scopes manual action visibility.

## Deliberately inferred facts

- A visible **List on Transfer Market** or **Send to Transfer List** action implies tradeability; absence does not imply untradeability.
- A visible `.icon_chemistry_first_owner` marker implies first-owner status; absence remains unknown.
- `specials` and `rare` card classes provide only a broad rarity family, not an exact promotion identity.
- A `loan` item class provides a loan-state inference.

## Compatibility risks

- The screen heading and action labels are locale-dependent.
- `tns-slide-active` belongs to the carousel implementation and may change independently of EA field classes.
- Club, league, nation, exact promotion, resource ID, and Web App build were not available as reliable visible text in this observation.
- Hidden action buttons remain in the DOM, so action inference must test actual visibility.

No account header values, club identity, balances, player inventory, raw HTML, cookies, tokens, headers, or network responses were retained.
