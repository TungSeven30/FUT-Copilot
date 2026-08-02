import {
  marketTransactionSchema,
  type MarketTransaction,
} from '@fut-copilot/domain/workflows';
import type { Platform } from '@fut-copilot/domain/common';

import type { FutCopilotDatabase } from './database';

export async function recordMarketTransaction(
  database: FutCopilotDatabase,
  input: {
    profileId: string;
    cardDefinitionId: string;
    ownedCardId?: string;
    transactionType: MarketTransaction['transactionType'];
    amount: number;
    platform?: Platform;
    eaTax?: number;
    notes?: string;
    userConfirmed: true;
    createId?: () => string;
    now?: () => Date;
  },
): Promise<MarketTransaction> {
  const transaction = marketTransactionSchema.parse({
    id: (input.createId ?? (() => crypto.randomUUID()))(),
    profileId: input.profileId,
    cardDefinitionId: input.cardDefinitionId,
    ...(input.ownedCardId === undefined
      ? {}
      : { ownedCardId: input.ownedCardId }),
    platform: input.platform ?? 'playstation',
    transactionType: input.transactionType,
    amount: input.amount,
    ...(input.eaTax === undefined ? {} : { eaTax: input.eaTax }),
    occurredAt: (input.now ?? (() => new Date()))().toISOString(),
    userConfirmed: input.userConfirmed,
    notes: input.notes ?? '',
  });
  await database.marketTransactions.add(transaction);
  return transaction;
}

export async function getMarketTransactions(
  database: FutCopilotDatabase,
  cardDefinitionId: string,
): Promise<MarketTransaction[]> {
  const entries = await database.marketTransactions
    .where('cardDefinitionId')
    .equals(cardDefinitionId)
    .toArray();
  return entries
    .map((entry) => marketTransactionSchema.parse(entry))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}
