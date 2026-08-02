import type { VisibleCard } from '@fut-copilot/domain/adapter-events';
import type { CardDefinition } from '@fut-copilot/domain/cards';
import type { Observation } from '@fut-copilot/domain/observation';

import { FutCopilotDatabase } from './database';
import {
  DEFAULT_PROFILE_ID,
  ensureDefaultProfile,
  ensureSelectedCardContext,
  getLatestMarketObservation,
  recordManualMarketObservation,
  updateOwnedCardPersonalization,
  updateOwnedCardPurchasePrice,
} from './personalization';

const databases: FutCopilotDatabase[] = [];
const observedAt = '2026-08-01T15:00:00.000Z';

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

function visibleCard(): VisibleCard {
  return {
    localObservationId: '9179e572-a8c1-4e59-8cd9-049c3fd1d0b6',
    name: known('Alex Example'),
    overall: known(91),
    position: known('ST'),
    club: unknown(),
    league: unknown(),
    nation: unknown(),
    rarity: known('special'),
    tradeability: known('tradeable'),
    firstOwner: unknown(),
    loan: known(false),
    faceStats: [],
  };
}

function createDatabase() {
  const database = new FutCopilotDatabase(
    `fut-copilot-personalization-${crypto.randomUUID()}`,
  );
  databases.push(database);
  return database;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe('personalized selected-card storage', () => {
  it('creates the default PlayStation profile and seven tags once', async () => {
    const database = createDatabase();
    const first = await ensureDefaultProfile(
      database,
      () => new Date(observedAt),
    );
    const second = await ensureDefaultProfile(
      database,
      () => new Date(observedAt),
    );

    expect(first.profile.platform).toBe('playstation');
    expect(first.tags).toHaveLength(7);
    expect(second.tags).toHaveLength(7);
    expect(await database.profiles.count()).toBe(1);
  });

  it('persists tags, protection, and notes when the card is observed again', async () => {
    const database = createDatabase();
    const ids = [
      '1c41a4cf-2652-4d2f-b8ac-1f7af6bb82f3',
      'a2e67afe-0dc8-41c8-bdb9-7a0c05d4bd25',
    ];
    let idIndex = 0;
    const context = await ensureSelectedCardContext(database, visibleCard(), {
      createId: () => ids[idIndex++] ?? crypto.randomUUID(),
      now: () => new Date(observedAt),
    });
    const protectedTag = context.tags.find((tag) => tag.name === 'protected');
    if (context.ownedCard === null || protectedTag === undefined) {
      throw new Error('Expected a persisted owned-card context.');
    }

    await updateOwnedCardPersonalization(database, {
      ownedCardId: context.ownedCard.id,
      personalTagIds: [protectedTag.id],
      notes: 'Keep for my main squad.',
    });
    const repeated = await ensureSelectedCardContext(database, visibleCard(), {
      now: () => new Date('2026-08-01T16:00:00.000Z'),
    });

    expect(repeated.identity.status).toBe('resolved');
    expect(repeated.ownedCard).toMatchObject({
      protected: true,
      notes: 'Keep for my main squad.',
      personalTagIds: [protectedTag.id],
    });
    expect(await database.cardDefinitions.count()).toBe(1);
  });

  it('restores personalization after the local database is closed and reopened', async () => {
    const databaseName = `fut-copilot-restart-${crypto.randomUUID()}`;
    const firstSession = new FutCopilotDatabase(databaseName);
    const firstContext = await ensureSelectedCardContext(
      firstSession,
      visibleCard(),
      { now: () => new Date(observedAt) },
    );
    const favoriteTag = firstContext.tags.find(
      (tag) => tag.name === 'favorite',
    );
    if (firstContext.ownedCard === null || favoriteTag === undefined) {
      throw new Error('Expected a persisted owned-card context.');
    }
    await updateOwnedCardPersonalization(firstSession, {
      ownedCardId: firstContext.ownedCard.id,
      personalTagIds: [favoriteTag.id],
      notes: 'Persists across extension restarts.',
    });
    firstSession.close();

    const reopened = new FutCopilotDatabase(databaseName);
    databases.push(reopened);
    const restored = await ensureSelectedCardContext(reopened, visibleCard(), {
      now: () => new Date('2026-08-01T16:00:00.000Z'),
    });

    expect(restored.ownedCard).toMatchObject({
      protected: true,
      personalTagIds: [favoriteTag.id],
      notes: 'Persists across extension restarts.',
    });
  });

  it('returns ambiguity instead of choosing between duplicate definitions', async () => {
    const database = createDatabase();
    const baseContext = await ensureSelectedCardContext(
      database,
      visibleCard(),
      {
        now: () => new Date(observedAt),
      },
    );
    if (baseContext.cardDefinition === null) {
      throw new Error('Expected a card definition.');
    }
    const secondDefinition: CardDefinition = {
      ...baseContext.cardDefinition,
      id: 'ac0b5c2a-3010-46ce-9b2e-f544cd68fe82',
    };
    await database.cardDefinitions.add(secondDefinition);

    const ambiguous = await ensureSelectedCardContext(database, visibleCard(), {
      now: () => new Date(observedAt),
    });

    expect(ambiguous.identity.status).toBe('ambiguous');
    expect(ambiguous.ownedCard).toBeNull();
    expect(ambiguous.profile.id).toBe(DEFAULT_PROFILE_ID);
  });

  it('stores manual PlayStation prices and purchase cost separately', async () => {
    const database = createDatabase();
    const context = await ensureSelectedCardContext(database, visibleCard(), {
      now: () => new Date(observedAt),
    });
    if (context.cardDefinition === null || context.ownedCard === null) {
      throw new Error('Expected a persisted selected-card context.');
    }
    await recordManualMarketObservation(database, {
      profileId: context.profile.id,
      cardDefinitionId: context.cardDefinition.id,
      amount: 42_000,
      now: () => new Date(observedAt),
    });
    const updated = await updateOwnedCardPurchasePrice(database, {
      ownedCardId: context.ownedCard.id,
      amount: 35_000,
      now: () => new Date(observedAt),
    });

    expect(
      (await getLatestMarketObservation(database, context.cardDefinition.id))
        ?.amount,
    ).toBe(42_000);
    expect(updated.purchasePrice?.value).toBe(35_000);
  });

  it('keeps a new Transfer List observation ownership-safe until Club confirms it', async () => {
    const database = createDatabase();
    const transferContext = await ensureSelectedCardContext(
      database,
      visibleCard(),
      {
        location: 'transfer-list',
        newOwnershipStatus: 'unknown',
        now: () => new Date(observedAt),
      },
    );

    expect(transferContext.ownedCard).toMatchObject({
      location: 'transfer-list',
      ownershipStatus: 'unknown',
    });

    const clubContext = await ensureSelectedCardContext(
      database,
      visibleCard(),
      {
        now: () => new Date('2026-08-01T16:00:00.000Z'),
      },
    );
    expect(clubContext.ownedCard).toMatchObject({
      location: 'club',
      ownershipStatus: 'owned',
    });
    expect(await database.ownedCards.count()).toBe(1);
  });
});
