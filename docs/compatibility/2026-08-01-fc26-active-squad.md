# FC 26 active-squad compatibility

- Observation date: 2026-08-01
- Adapter version: `fc26-web-v0.2.0`
- Route family: official Ultimate Team Web App root
- Screen: Active Squad with starting XI, substitutes, reserves, and manager
- Locale: English
- Web App build identifier: unknown
- Sanitized fixture: `active-squad-live-contract`
- Result: supported with explicit partial-field boundaries

## Stable-enough anchors for this adapter

- One `.ut-squad-actions-view` and one `.ut-squad-overview` identify the squad
  management layout independently of the root URL.
- One `.ut-squad-pitch-view` contains twelve slots: eleven player slots and one
  manager slot identified by a descendant `.manager` marker.
- Two ordered `.ut-squad-slot-dock-view--slot-container` elements contain seven
  substitute slots and five reserve slots.
- `.ut-squad-slot-view` identifies a slot; `.player.ut-item-loaded` identifies
  one fully loaded player card inside it.
- `.rating` and `.position` expose the only required core player facts on the
  small squad card.
- `specials`, `rare`, `loan`, and a visible
  `.icon_chemistry_first_owner` provide only the same narrow inferences named by
  their normalized evidence codes.

## Deliberately unknown facts

- Player names are not exposed as visible text or accessible labels on the
  observed small squad cards. The adapter records the name as unknown and does
  not inspect image URLs, hidden application state, or network responses.
- Club, league, nation, exact promotion, tradeability, card IDs, and the Web App
  build remain unknown.
- Absence of a visible first-owner marker remains unknown rather than false.
- Face statistics embedded in non-visible card-detail markup are not extracted
  from this screen.

## Fail-closed shape rules

- The adapter requires exactly 11 player pitch slots plus one unambiguous
  manager slot, then 7 substitute slots and 5 reserve slots.
- A slot with no player marker is preserved as empty. A player marker that is
  not loaded is a degraded state, not an empty slot.
- Multiple loaded players, missing or ambiguous rating/position fields, concept
  cards, or changed group counts degrade the whole observation instead of
  producing a partial or guessed squad.
- Normalized slot identifiers preserve visible group order as `START-1..11`,
  `SUB-1..7`, and `RES-1..5`; they do not claim formation-position identity.

## Compatibility risks

- The manager marker, group counts, and ordered dock containers are live layout
  assumptions and must be revalidated after EA layout changes.
- A future layout that exposes names accessibly can add them only after another
  sanitized observation and fixture update.
- Empty-manager behavior was not observed, so a missing manager marker degrades
  rather than guessing which of twelve pitch slots is the manager.

No account header value, club identity, balance, player name, inventory list,
raw HTML, image URL, cookie, token, header, or network response was retained.
