import type { PersonalProfile } from '@fut-copilot/domain/profile';

import { FutCopilotDatabase, tableNames } from './database';

const databases: FutCopilotDatabase[] = [];

function makeProfile(
  id = crypto.randomUUID(),
  displayName = 'Local player',
): PersonalProfile {
  const timestamp = '2026-08-01T15:00:00.000Z';

  return {
    id,
    displayName,
    platform: 'playstation',
    favoritePlayerNames: [],
    favoriteClubNames: [],
    recommendationWeights: {
      metaPerformance: 0.8,
      favoritePlayer: 1,
      favoriteClub: 0.8,
      evolutionPotential: 0.9,
      marketValue: 0.6,
      sbcUtility: 0.7,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createDatabase() {
  const database = new FutCopilotDatabase(
    `fut-copilot-test-${crypto.randomUUID()}`,
  );
  databases.push(database);
  return database;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe('FutCopilotDatabase', () => {
  it('initializes every version-one table', async () => {
    const database = createDatabase();
    await database.open();

    expect(database.tables.map((table) => table.name).sort()).toEqual(
      [...tableNames].sort(),
    );
  });

  it('creates, updates, and queries a profile', async () => {
    const database = createDatabase();
    const profile = makeProfile();

    await database.profiles.add(profile);
    await database.profiles.update(profile.id, {
      favoriteClubNames: ['Liverpool'],
      updatedAt: '2026-08-01T16:00:00.000Z',
    });

    const stored = await database.profiles.get(profile.id);

    expect(stored?.favoriteClubNames).toEqual(['Liverpool']);
  });

  it('rolls back a failed transaction', async () => {
    const database = createDatabase();

    await expect(
      database.transaction('rw', database.profiles, async () => {
        await database.profiles.add(makeProfile());
        throw new Error('intentional rollback');
      }),
    ).rejects.toThrow('intentional rollback');

    expect(await database.profiles.count()).toBe(0);
  });
});
