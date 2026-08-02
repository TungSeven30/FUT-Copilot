import { FutCopilotDatabase } from './database';
import {
  getMarketTransactions,
  recordMarketTransaction,
} from './market-journal';

const databases: FutCopilotDatabase[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe('market transaction journal', () => {
  it('stores only explicit user-confirmed lifecycle events', async () => {
    const database = new FutCopilotDatabase(
      `fut-copilot-journal-${crypto.randomUUID()}`,
    );
    databases.push(database);
    const cardDefinitionId = 'ac821913-112e-4139-8daa-59ce2432ba0d';
    await recordMarketTransaction(database, {
      profileId: '336361f1-c63d-423f-a1f1-3d57372f0260',
      cardDefinitionId,
      transactionType: 'purchased',
      amount: 10_000,
      userConfirmed: true,
      now: () => new Date('2026-08-01T15:00:00.000Z'),
    });
    await recordMarketTransaction(database, {
      profileId: '336361f1-c63d-423f-a1f1-3d57372f0260',
      cardDefinitionId,
      transactionType: 'sold',
      amount: 12_000,
      userConfirmed: true,
      now: () => new Date('2026-08-01T16:00:00.000Z'),
    });

    const entries = await getMarketTransactions(database, cardDefinitionId);
    expect(entries.map((entry) => entry.transactionType)).toEqual([
      'sold',
      'purchased',
    ]);
    expect(entries.every((entry) => entry.userConfirmed)).toBe(true);
  });
});
