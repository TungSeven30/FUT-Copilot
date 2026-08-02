# FC 26 SBC requirements compatibility

## Observation scope

- Date: 2026-08-01
- Locale: English
- Route family: SBC challenge detail
- State: single-segment challenge with an empty squad
- Adapter version: `fc26-web-v0.4.0`
- Sanitized fixture: `sbc-live-requirements-contract`
- Build identifier: not exposed reliably; recorded as unknown

The observation was read-only. FUT Copilot did not use Squad Builder, place a
card, clear the squad, exchange players, submit the challenge, or claim a
reward. No account identity, balance, inventory value, credential, cookie,
token, authenticated response, or raw page HTML was retained.

## Stable visible anchors

- Exactly one `.ut-root-view h1.title` supplies the visible challenge name.
- Exactly one `.SquadPanel.SBCSquadPanel` contains the challenge content.
- Exactly one `.ut-sbc-challenge-details-view` identifies the challenge detail
  view.
- Two visible `.sbc-requirements-checklist` elements repeat the same ordered
  requirement labels. The adapter emits one ordered copy only when both lists
  agree exactly.
- One `.ut-squad-pitch-view.sbc` contains 11 squad slots.
- One `.ut-squad-slot-dock-view.sbc` contains 12 work-area slots.
- Empty slots contain one `.player` shell without `.ut-item-loaded`.

## Normalized output and uncertainty

- The challenge heading is emitted as known visible UI text.
- No distinct segment name was exposed in the observed single-segment layout,
  so `segmentName` remains unknown with explicit evidence.
- Matching requirement labels are emitted once in visible order.
- The observed empty squad emits `cards: []`.
- The observed Bronze-quality constraint is not a rating-only requirement. The
  planner displays it as unsupported and cannot mark a proposal valid.

## Fail-closed cases

The adapter degrades instead of emitting SBC context when:

- challenge anchors or the one-heading boundary change;
- the two requirement checklists are absent, empty, or disagree;
- the pitch/work-area slot shape is not exactly 11 + 12;
- an empty slot lacks the observed player shell; or
- any SBC player card is loaded.

Populated SBC cards remain unsupported until a separate user-assisted
observation validates their visible card shape and ordering. This deliberately
prevents the active-squad card contract from being guessed onto a different
workflow.
