# FC 26 SBC rating model

Status: implemented as a locally validated approximation pending confirmation
against a visible EA SBC segment.

EA does not publish the exact numeric SBC squad-rating formula. FUT Copilot uses
the correction-factor model documented by current public FC 26 community
references:

1. Sum all selected player ratings.
2. Calculate the unrounded average.
3. Add each positive difference between a player rating and that average.
4. Round the correction-adjusted total to the nearest integer.
5. Divide by the number of required players and round down.

The order matters. Dividing before rounding incorrectly evaluates public
boundary examples such as two 91-rated plus nine 88-rated cards.

## Evidence and limitations

- [FC 26 Squad Rating Guide](https://fifauteam.com/fc-26-squad-rating-guide/)
  describes the correction factor and intermediate rounding order.
- [FUTBIN FC 26 rating combinations](https://www.futbin.com/squad-building-challenges/rating-combinations)
  gives public cross-check combinations, including `2 × 91 + 9 × 88` for an
  89-rated SBC and `2 × 90 + 9 × 87` for an 88-rated SBC.

These are third-party sources, not an EA contract. The implementation therefore
remains a reviewable local proposal tool, never submits an SBC, and must be
rechecked against the supported live EA build before the release gate closes.

Automated tests compare the floating-point implementation with an independent
integer-arithmetic reference for every two-rating, eleven-player combination
from 40 through 99. This proves internal arithmetic consistency but does not
replace live EA validation.
