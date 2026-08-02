import type { CardDefinition, OwnedCard } from '@fut-copilot/domain/cards';
import type { Observation } from '@fut-copilot/domain/observation';
import type { PersonalTag } from '@fut-copilot/domain/profile';

import {
  calculateSquadRating,
  parseRatingOnlyRequirements,
  planRatingOnlySbc,
  validateRatingOnlyPlan,
  type SbcPlannerCard,
} from './sbc';

const observedAt = '2026-08-01T15:00:00.000Z';
const profileId = '67f2fb80-bb00-4755-8e80-e8e61749bc70';
const protectedTag: PersonalTag = {
  id: 'c12569c2-2d86-425b-8898-03b672a37556',
  profileId,
  name: 'protected',
  color: '#ff6b6b',
  protectsCard: true,
  createdAt: observedAt,
};

function known<T>(value: T): Observation<T> {
  return { value, source: 'local-history', observedAt, status: 'known' };
}

function unknown<T>(): Observation<T> {
  return {
    value: null,
    source: 'local-history',
    observedAt,
    status: 'unknown',
  };
}

function plannerCard(
  rating: number,
  index: number,
  options: { protected?: boolean; duplicate?: boolean } = {},
): SbcPlannerCard {
  const suffix = String(index).padStart(12, '0');
  const definitionId = `00000000-0000-4000-8000-${suffix}`;
  const ownedId = `10000000-0000-4000-8000-${suffix}`;
  const definition: CardDefinition = {
    id: definitionId,
    fcYear: 26,
    assetId: unknown(),
    resourceId: unknown(),
    name: known(`Card ${index}`),
    overall: known(rating),
    position: known('CM'),
    club: unknown(),
    league: unknown(),
    nation: unknown(),
    rarity: known('rare'),
    promotion: unknown(),
    identityConfidence: 0.8,
    createdAt: observedAt,
    updatedAt: observedAt,
  };
  const ownedCard: OwnedCard = {
    id: ownedId,
    cardDefinitionId: definitionId,
    profileId,
    ownershipStatus: 'owned',
    tradeability: 'untradeable',
    firstOwner: unknown(),
    location: 'club',
    platform: 'playstation',
    protected: options.protected ?? false,
    personalTagIds: options.protected ? [protectedTag.id] : [],
    notes: '',
    firstObservedAt: observedAt,
    lastObservedAt: observedAt,
  };
  return {
    ownedCard,
    definition,
    tags: [protectedTag],
    duplicate: options.duplicate ?? false,
  };
}

function referenceSquadRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const playerCount = ratings.length;
  const sum = ratings.reduce((total, rating) => total + rating, 0);
  const excessNumerator = ratings.reduce(
    (total, rating) => total + Math.max(0, rating * playerCount - sum),
    0,
  );
  const correctedNumerator = sum * playerCount + excessNumerator;
  const roundedCorrectedTotal = Math.floor(
    (2 * correctedNumerator + playerCount) / (2 * playerCount),
  );
  return Math.floor(roundedCorrectedTotal / playerCount);
}

describe('rating-only SBC planner', () => {
  it('parses supported visible labels and rejects complex requirements', () => {
    expect(
      parseRatingOnlyRequirements([
        'Players: 11',
        'Team Overall Rating: Min. 84',
      ]),
    ).toMatchObject({
      supported: true,
      requiredPlayers: 11,
      requiredRating: 84,
    });
    expect(
      parseRatingOnlyRequirements([
        'Players: 11',
        'Team Overall Rating: Min. 84',
        'Team Chemistry: Min. 20',
      ]).supported,
    ).toBe(false);
    expect(
      parseRatingOnlyRequirements([
        'Number of Players in the Squad: 11',
        'Squad Rating: Min. 84',
      ]),
    ).toMatchObject({
      supported: true,
      requiredPlayers: 11,
      requiredRating: 84,
    });
  });

  it('never mistakes constrained-player or unknown labels for squad size', () => {
    const rarePlayers = parseRatingOnlyRequirements([
      'Players: 11',
      'Team Overall Rating: Min. 84',
      'Rare Players: Min. 2',
    ]);
    expect(rarePlayers).toMatchObject({
      supported: false,
      requiredPlayers: 11,
      requiredRating: 84,
      unsupportedLabels: ['Rare Players: Min. 2'],
    });

    const totwOnly = parseRatingOnlyRequirements([
      'TOTW Players: Min. 1',
      'Unrecognized special constraint',
    ]);
    expect(totwOnly).toMatchObject({
      supported: false,
      requiredPlayers: null,
      requiredRating: null,
      unsupportedLabels: [
        'TOTW Players: Min. 1',
        'Unrecognized special constraint',
      ],
    });
  });

  it('keeps the observed Bronze-only challenge fail closed', () => {
    expect(
      parseRatingOnlyRequirements([
        'Player Quality: Exactly Bronze',
        'Number of Players in the Squad: 1',
      ]),
    ).toEqual({
      supported: false,
      requiredPlayers: 1,
      requiredRating: null,
      unsupportedLabels: ['Player Quality: Exactly Bronze'],
    });
  });

  it('calculates uniform and mixed squad rating boundaries', () => {
    expect(calculateSquadRating(Array.from({ length: 11 }, () => 84))).toBe(84);
    expect(
      calculateSquadRating([85, 85, 85, 85, 85, 84, 84, 84, 84, 84, 84]),
    ).toBe(84);
    expect(
      calculateSquadRating([86, 86, 86, 86, 86, 84, 84, 84, 84, 84, 84]),
    ).toBe(85);
    expect(calculateSquadRating([91, 91, ...Array(9).fill(88)])).toBe(89);
    expect(calculateSquadRating([90, 90, ...Array(9).fill(87)])).toBe(88);
  });

  it('matches an integer reference across the full practical rating range', () => {
    for (let lower = 40; lower <= 99; lower += 1) {
      for (let higher = lower; higher <= 99; higher += 1) {
        for (let higherCount = 0; higherCount <= 11; higherCount += 1) {
          const ratings = [
            ...Array(higherCount).fill(higher),
            ...Array(11 - higherCount).fill(lower),
          ] as number[];
          expect(calculateSquadRating(ratings)).toBe(
            referenceSquadRating(ratings),
          );
        }
      }
    }
  });

  it('excludes protected cards even when they are needed for rating', () => {
    const cards = [
      plannerCard(95, 1, { protected: true }),
      ...Array.from({ length: 11 }, (_, index) => plannerCard(84, index + 2)),
    ];
    const plan = planRatingOnlySbc({
      cards,
      requiredPlayers: 11,
      requiredRating: 85,
      strategy: 'club-preservation',
    });

    expect(plan.valid).toBe(false);
    expect(plan.excludedProtectedCardIds).toEqual([cards[0]?.ownedCard.id]);
  });

  it('keeps an independently valid proposal and favors a duplicate', () => {
    const cards = [
      ...Array.from({ length: 11 }, (_, index) => plannerCard(86, index + 1)),
      plannerCard(85, 12, { duplicate: true }),
    ];
    const plan = planRatingOnlySbc({
      cards,
      requiredPlayers: 11,
      requiredRating: 85,
      strategy: 'duplicate-cleanup',
    });

    expect(plan.valid).toBe(true);
    expect(plan.selected.some((card) => card.duplicate)).toBe(true);
    expect(plan.overshoot).toBeGreaterThanOrEqual(0);
    expect(
      plan.selectionReasons.some((reason) =>
        reason.reason.includes('Duplicate prioritized'),
      ),
    ).toBe(true);
    expect(
      plan.selectionReasons.every(
        (reason) => reason.confidence >= 0 && reason.confidence <= 1,
      ),
    ).toBe(true);
    expect(validateRatingOnlyPlan(plan.selected, 11, 85).valid).toBe(true);
  });

  it('fails closed when locally known inventory is incomplete', () => {
    const plan = planRatingOnlySbc({
      cards: [plannerCard(99, 1)],
      requiredPlayers: 11,
      requiredRating: 84,
      strategy: 'low-coin-cost',
    });

    expect(plan.valid).toBe(false);
    expect(plan.warnings[0]).toContain('Only 1 eligible');
  });
});
