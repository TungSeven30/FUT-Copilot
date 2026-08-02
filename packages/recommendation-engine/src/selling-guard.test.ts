import type { OwnedCard } from '@fut-copilot/domain/cards';
import type { PersonalTag } from '@fut-copilot/domain/profile';

import { evaluateSellingGuard } from './selling-guard';

const observedAt = '2026-08-01T15:00:00.000Z';
const protectedTag: PersonalTag = {
  id: 'a4a54439-96ac-462f-adc5-c6be399d9ca7',
  profileId: '43fac2ac-8ba3-4eb7-a866-2f7a924fc799',
  name: 'favorite',
  color: '#ffd166',
  protectsCard: true,
  createdAt: observedAt,
};
const card: OwnedCard = {
  id: 'ca27eb4f-bfc2-4398-9df9-951c5d2a92fc',
  cardDefinitionId: '7c7bc8c1-da9e-43c6-80f7-450cf01b55ac',
  profileId: protectedTag.profileId,
  ownershipStatus: 'owned',
  tradeability: 'unknown',
  firstOwner: {
    value: null,
    source: 'ea-visible-ui',
    observedAt,
    status: 'unknown',
  },
  location: 'club',
  platform: 'playstation',
  protected: true,
  personalTagIds: [protectedTag.id],
  notes: '',
  firstObservedAt: observedAt,
  lastObservedAt: observedAt,
};

describe('selling guard', () => {
  it('warns for protection, price floor, and unknown tradeability', () => {
    const result = evaluateSellingGuard({
      ownedCard: card,
      tags: [protectedTag],
      proposedListPrice: 20_000,
      personalMinimum: 25_000,
    });
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'protected-card',
      'below-personal-minimum',
      'tradeability-unknown',
    ]);
  });
});
