# FC 26 populated SBC-card compatibility

## Observation scope

- Date: 2026-08-02
- Locale: English
- Route family: SBC challenge builder
- State: one owner-populated selected pitch slot
- Adapter version: `fc26-web-v0.7.0`
- Sanitized fixture: `sbc-live-populated-card-contract`
- Build identifier: not exposed reliably; recorded as unknown

The owner placed one expendable, unprotected player before observation. FUT
Copilot then performed read-only structural inspection only. It did not place,
clear, exchange, submit, claim, search for, or activate any card or SBC control.
No player identity, account value, credential, cookie, token, authenticated
response, or raw page HTML was retained.

## Stable visible anchors

- One primary landscape navigation heading supplies the challenge name. The
  secondary item-search heading is deliberately excluded.
- One `.ut-squad-overview` contains one `.ut-squad-pitch-view.sbc` with 11
  slots and one `.ut-squad-slot-dock-view.sbc` with 12 work-area slots.
- The builder exposes one ordered `.sbc-requirements-checklist` and one
  `.ut-item-search-view.filter-container`.
- A populated slot contains exactly one `.player.ut-item-loaded`.
- The compact loaded card exposes exactly one `.rating` and one `.position`
  anchor, but no visible `.name` anchor.
- The selected slot used `.ui-slot-selected`. A separate visible pinned row
  exposed a name and matching compact values, but the DOM did not prove that
  row represented the same owned item as the loaded slot.

## Normalized output and uncertainty

- Requirement labels are emitted from the single visible builder checklist in
  order.
- Loaded cards are emitted in pitch order followed by work-area order.
- Rating and position are known visible facts when their anchors are unique and
  valid.
- Name remains unknown even for the selected slot. FUT Copilot refuses to join
  the separate pinned row to the slot using rating and position alone.
- Club, league, nation, and tradeability remain unknown. Recognized rarity,
  first-owner, and loan classes are narrow visible inferences only.
- An unknown SBC-card identity keeps the local protection scan unresolved and
  therefore prevents a proposal from being marked valid.

## Fail-closed cases

The adapter degrades instead of emitting populated SBC context when:

- the primary builder heading, overview, checklist, pitch, work area, or item
  search boundary changes;
- pitch/work-area slot shape is not exactly 11 + 12;
- a slot does not contain exactly one player shell;
- a loaded slot has multiple player anchors or lacks one valid rating or
  position; or
- a loaded card is marked as a concept item.

The account-free fixture covers populated extraction, pitch-before-work-area
ordering, pinned-row non-association, structural ambiguity, and dispatcher
routing. The complete repository verification pipeline is recorded in the
release verification record.
