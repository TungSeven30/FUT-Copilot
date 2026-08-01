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
  });

  it('calculates uniform and mixed squad rating boundaries', () => {
    expect(calculateSquadRating(Array.from({ length: 11 }, () => 84))).toBe(84);
    expect(
      calculateSquadRating([85, 85, 85, 85, 85, 84, 84, 84, 84, 84, 84]),
    ).toBe(84);
    expect(
      calculateSquadRating([86, 86, 86, 86, 86, 84, 84, 84, 84, 84, 84]),
    ).toBe(85);
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
