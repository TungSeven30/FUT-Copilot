import { ownedCardSchema } from './cards';

const baseOwnedCard = {
  id: 'a734d958-d910-4dd7-9d19-7cbfa4a48a1f',
  cardDefinitionId: '4af23ac7-d667-48f6-ab51-2687c404ad55',
  profileId: '92f8fc89-5cc8-4792-8e02-d26677749f88',
  ownershipStatus: 'owned',
  firstOwner: {
    value: null,
    source: 'ea-visible-ui',
    observedAt: '2026-08-01T15:00:00.000Z',
    status: 'unknown',
  },
  location: 'club',
  platform: 'playstation',
  protected: false,
  personalTagIds: [],
  notes: '',
  firstObservedAt: '2026-08-01T15:00:00.000Z',
  lastObservedAt: '2026-08-01T15:00:00.000Z',
};

describe('owned card schema', () => {
  it('requires tradeability instead of guessing it', () => {
    expect(ownedCardSchema.safeParse(baseOwnedCard).success).toBe(false);
  });

  it('accepts explicit unknown tradeability', () => {
    const result = ownedCardSchema.parse({
      ...baseOwnedCard,
      tradeability: 'unknown',
    });

    expect(result.tradeability).toBe('unknown');
  });
});
