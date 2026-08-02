# FC 26 pack-result and duplicate compatibility

## Observation scope

- Date: 2026-08-02
- Locale: English
- Route family: Store result / Unassigned
- State: populated result with regular items and visible duplicates
- Adapter version: `fc26-web-v0.6.0`
- Sanitized fixture: `pack-result-live-unassigned-contract`
- Build identifier: not exposed reliably; recorded as unknown

The owner opened the pack manually and stopped on the result screen. FUT
Copilot did not open a pack, send an item, list an item, compare a price,
discard, quick-sell, advance, or otherwise activate a result action. No account
identity, balance, player identity, item value, credential, cookie, token,
authenticated response, image URL, or raw page HTML was retained.

## Stable visible anchors

- Exactly one `.ut-root-view h1.title` contains the English **Unassigned**
  heading.
- Exactly one `.ut-unassigned-view.ui-layout-left` contains the result.
- Direct `.ut-sectioned-item-list-view` children are identified by one direct
  `.ut-section-header-view h2`: **Items** is required first and **Duplicates**
  is optional second.
- Direct `.itemList > .listFUTItem` rows preserve visible order inside each
  section.
- Each supported row has exactly one direct `.rowContent.has-tap-callback`, one
  `.entityContainer`, and one `.item.player.ut-item-loaded` player card.
- The row `.name` plus card `.rating` and `.position` provide the required
  visible player facts.
- `specials`, `rare`, `common`, `loan`, and a visible
  `.icon_chemistry_first_owner` provide only the narrow inferences named by the
  normalized evidence codes.

## Normalized order and duplicate handling

- `packResult.visible.payload.cards` contains regular Items first, followed by
  Duplicates, preserving order within both visible sections.
- `duplicateIndexes` identifies the appended duplicate rows without guessing
  from card identity.
- Tradeability remains unknown because only the selected row exposes result
  actions and that does not prove the state of every visible card.
- Each marked duplicate produces a normalized local duplicate event with its
  visible pack index. Repeated observations inside the stability window reuse
  the same event and local triage case even when several duplicates are visible.
- The final side-panel snapshot remains the pack summary; duplicate case
  creation is local-only and does not activate an EA control.

## Fail-closed cases

The adapter degrades or reports the screen unsupported instead of emitting a
partial pack when:

- the Unassigned heading, view, section headings, or section order changes;
- an unknown or repeated result section appears;
- a row lacks exactly one loaded player card or visible name/rating/position;
- a row is a concept item; or
- the result contains no supported player cards.

Non-player pack items were not present in this observation and remain
unsupported. Player-pick layouts require a separate naturally reached live
observation.
