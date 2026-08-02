# Known limitations

## Live EA support

- Live-validated: English FC 26 Web App, **My Club Players**, one visible
  selected card; and **Active Squad**, with 11 starting player slots, 7
  substitutes, and 5 reserves; and **Transfer List**, with one selected detailed
  card and scoped displayed coin values.
- Synthetic-only adapter contracts: pack result, player pick, duplicate, and
  SBC contexts.
- Small Active Squad cards do not expose player names as accessible visible
  text. Squad observations therefore preserve slot, rating, position, and
  narrow state markers while leaving names and hidden identity fields unknown.
- The panel fails closed on unsupported or changed layouts; it does not guess a
  card when required anchors are missing or ambiguous.
- EA Web App UI changes or non-English text may require a versioned adapter
  update and a new compatibility record.

## Identity and club knowledge

- There is no automatic full-club sync.
- Exact EA resource/asset IDs are not read by the live selected-card adapter.
- A visible card may create a composite local identity. Multiple matches remain
  ambiguous and receive no automatic personalization attachment.
- SBC inventory contains only cards FUT Copilot already knows locally.

## SBC and duplicate workflows

- The planner supports rating-only squads. Chemistry and complex rarity,
  league, club, or nation constraints are flagged as unsupported.
- The correction-factor rating model is based on current public community
  documentation because EA does not publish an exact formula. It has broad
  integer-reference tests but remains provisional until live SBC confirmation;
  see the [SBC rating model](../research/sbc-rating-model.md).
- A visible SBC card blocks local proposal validity when its local identity is
  unresolved or any matching owned copy is protected. This check depends on
  cards already known to FUT Copilot and is not a full-club ownership sync.
- It creates a reviewable local proposal only. It cannot place players or
  submit an SBC.
- The duplicate queue can record user-confirmed triage state, but it cannot
  move, list, submit, discard, or quick-sell an item.
- Pack opening and player-pick selection always remain manual.

## Market and FUT.GG

- Prices and transaction events are entered manually and can become stale.
- Transfer List coin values are visible read-only context. Their semantic label
  is not guessed and they are not automatically saved as market observations.
- A newly seen Transfer List card has unknown ownership status until Club
  context confirms it, preventing stale/sold listings from becoming SBC
  inventory.
- Tax defaults to 5% but is configurable in the calculator.
- FUT.GG opens only after a user click. High-confidence confirmed URLs may open
  directly; otherwise FUT Copilot opens a public player-name search.
- No FUT.GG API, automatic price fetch, scraping, or background network request
  is present.

## Platform and synchronization

- PlayStation is the default market platform; Xbox, PC, and unknown can be set.
- Data is local to one Chrome profile. There is no account, cloud sync, iPhone
  companion, or multi-device conflict resolution in this release.
