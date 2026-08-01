import type { CardDefinition, OwnedCard } from '@fut-copilot/domain/cards';
import type { Observation } from '@fut-copilot/domain/observation';
import type { PersonalTag } from '@fut-copilot/domain/profile';

import { calculateMarket } from './market';
import { recommendCard } from './recommendations';

const observedAt = '2026-08-01T15:00:00.000Z';
const protectedTag: PersonalTag = {
  id: '78eb57f3-d750-4ddd-9cd8-e214f76ed39f',
  profileId: 'ed003f21-a266-4207-984f-d730e6787016',
  name: 'protected',
  color: '#ff6b6b',
  protectsCard: true,
  createdAt: observedAt,
};

function known<T>(value: T): Observation<T> {
  return { value, source: 'ea-visible-ui', observedAt, status: 'known' };
}

function unknown<T>(): Observation<T> {
  return {
    value: null,
    source: 'ea-visible-ui',
    observedAt,
    status: 'unknown',
  };
}

const definition: CardDefinition = {
  id: 'b430ace6-38ef-45a4-980d-86f70cdb7b12',
  fcYear: 26,
  assetId: unknown(),
  resourceId: unknown(),
  name: known('Alex Example'),
  overall: known(91),
  position: known('ST'),
  club: unknown(),
  league: unknown(),
  nation: unknown(),
  rarity: known('special'),
  promotion: unknown(),
  identityConfidence: 0.765,
  createdAt: observedAt,
  updatedAt: observedAt,
};

function ownedCard(overrides: Partial<OwnedCard> = {}): OwnedCard {
  return {
    id: '7cd30b78-8e6b-4b36-bd18-6ad2a4feae8b',
    cardDefinitionId: definition.id,
    profileId: protectedTag.profileId,
    ownershipStatus: 'owned',
    tradeability: 'tradeable',
    firstOwner: unknown(),
    location: 'club',
    platform: 'playstation',
    protected: false,
    personalTagIds: [],
    notes: '',
    firstObservedAt: observedAt,
    lastObservedAt: observedAt,
    ...overrides,
  };
}

describe('recommendation engine v1', () => {
  it('lets protection override every numeric model', () => {
    const result = recommendCard({
      definition,
      ownedCard: ownedCard({
        personalTagIds: [protectedTag.id],
        protected: true,
      }),
      tags: [protectedTag],
      market: calculateMarket({
        observedPrice: 500_000,
        observedAt,
        now: new Date(observedAt),
      }),
      createId: () => '75d7310c-9291-4c2c-a66f-84241b0f4e3d',
      now: () => new Date(observedAt),
    });

    expect(result.primary.action).toBe('protect');
    expect(result.primary.confidence).toBe(1);
    expect(result.primary.reasons).toHaveLength(2);
  });

  it('reduces sell confidence when price and tradeability are missing', () => {
    const result = recommendCard({
      definition,
      ownedCard: ownedCard({ tradeability: 'unknown' }),
      tags: [],
      market: calculateMarket({}),
      createId: () => 'db5b70c7-ea8a-419b-bd4f-2870ee9210ed',
      now: () => new Date(observedAt),
    });
    const sell = result.models.find((model) => model.model === 'sell');

    expect(sell?.confidence).toBeLessThan(0.4);
    expect(sell?.reasons.map((reason) => reason.code)).toEqual([
      'tradeability-unknown',
      'price-missing',
    ]);
  });
});
