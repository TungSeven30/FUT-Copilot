import type { PersonalProfile, PersonalTag } from '@fut-copilot/domain/profile';

import { exportDatabase, importDatabase, previewImport } from './backup';
import { FutCopilotDatabase } from './database';

const databases: FutCopilotDatabase[] = [];
const timestamp = '2026-08-01T15:00:00.000Z';

function makeProfile(id = crypto.randomUUID()): PersonalProfile {
  return {
    id,
    displayName: 'Local player',
    platform: 'playstation',
    favoritePlayerNames: ['Thierry Henry'],
    favoriteClubNames: ['Arsenal'],
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
    `fut-copilot-backup-test-${crypto.randomUUID()}`,
  );
  databases.push(database);
  return database;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe('database backup and import', () => {
  it('round-trips supported data and previews counts', async () => {
    const source = createDatabase();
    const target = createDatabase();
    const profile = makeProfile();
    const tag: PersonalTag = {
      id: crypto.randomUUID(),
      profileId: profile.id,
      name: 'Evo project',
      color: '#bfff36',
      protectsCard: true,
      createdAt: timestamp,
    };

    await source.transaction(
      'rw',
      source.profiles,
      source.personalTags,
      async () => {
        await source.profiles.add(profile);
        await source.personalTags.add(tag);
      },
    );

    const backup = await exportDatabase(source);
    const preview = previewImport(backup);
    await importDatabase(target, backup, { mode: 'replace' });

    expect(preview.summary.totalRecords).toBe(2);
    expect(preview.summary.tableCounts.personalTags).toBe(1);
    expect(await target.profiles.get(profile.id)).toEqual(profile);
    expect(await target.personalTags.get(tag.id)).toEqual(tag);
  });

  it('rejects an unsupported newer schema before modifying the database', async () => {
    const database = createDatabase();
    const profile = makeProfile();
    await database.profiles.add(profile);

    const invalidFutureBackup = {
      format: 'fut-copilot-backup',
      schemaVersion: 2,
      createdAt: timestamp,
      data: {},
    };

    await expect(
      importDatabase(database, invalidFutureBackup, { mode: 'replace' }),
    ).rejects.toThrow();
    expect(await database.profiles.get(profile.id)).toEqual(profile);
  });

  it('can return a backup before replacing existing data', async () => {
    const source = createDatabase();
    const target = createDatabase();
    const oldProfile = makeProfile();
    const newProfile = makeProfile();
    await source.profiles.add(newProfile);
    await target.profiles.add(oldProfile);

    const result = await importDatabase(target, await exportDatabase(source), {
      mode: 'replace',
      createBackupBeforeReplace: true,
    });

    expect(result.priorBackup?.data.profiles).toEqual([oldProfile]);
    expect(await target.profiles.get(oldProfile.id)).toBeUndefined();
    expect(await target.profiles.get(newProfile.id)).toEqual(newProfile);
  });

  it('merges by primary key with the imported record winning', async () => {
    const source = createDatabase();
    const target = createDatabase();
    const sharedId = crypto.randomUUID();
    const importedProfile = {
      ...makeProfile(sharedId),
      displayName: 'Imported profile',
    };
    const preservedProfile = makeProfile();
    await source.profiles.add(importedProfile);
    await target.profiles.bulkAdd([
      { ...makeProfile(sharedId), displayName: 'Old profile' },
      preservedProfile,
    ]);

    const result = await importDatabase(target, await exportDatabase(source), {
      mode: 'merge',
    });

    expect(result.mergeConflictBehavior).toBe('imported-record-wins');
    expect((await target.profiles.get(sharedId))?.displayName).toBe(
      'Imported profile',
    );
    expect(await target.profiles.get(preservedProfile.id)).toEqual(
      preservedProfile,
    );
  });
});
