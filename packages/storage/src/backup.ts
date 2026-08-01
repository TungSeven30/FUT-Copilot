import { normalizedAdapterEventSchema } from '@fut-copilot/domain/adapter-events';
import {
  cardDefinitionSchema,
  ownedCardSchema,
} from '@fut-copilot/domain/cards';
import { isoDateTimeSchema } from '@fut-copilot/domain/common';
import {
  personalProfileSchema,
  personalTagSchema,
  protectionRuleSchema,
} from '@fut-copilot/domain/profile';
import {
  compatibilityRecordSchema,
  duplicateCaseSchema,
  marketObservationSchema,
  marketTransactionSchema,
  sbcDefinitionSchema,
  sbcProposalSchema,
} from '@fut-copilot/domain/workflows';
import { z } from 'zod';

import {
  DATABASE_VERSION,
  type DatabaseTableName,
  type FutCopilotDatabase,
  tableNames,
} from './database';

const backupDataSchema = z.object({
  profiles: z.array(personalProfileSchema),
  cardDefinitions: z.array(cardDefinitionSchema),
  ownedCards: z.array(ownedCardSchema),
  observations: z.array(normalizedAdapterEventSchema),
  personalTags: z.array(personalTagSchema),
  protectionRules: z.array(protectionRuleSchema),
  duplicateCases: z.array(duplicateCaseSchema),
  sbcDefinitions: z.array(sbcDefinitionSchema),
  sbcProposals: z.array(sbcProposalSchema),
  marketObservations: z.array(marketObservationSchema),
  marketTransactions: z.array(marketTransactionSchema),
  compatibilityRecords: z.array(compatibilityRecordSchema),
});

export const backupEnvelopeSchema = z.object({
  format: z.literal('fut-copilot-backup'),
  schemaVersion: z.literal(DATABASE_VERSION),
  createdAt: isoDateTimeSchema,
  data: backupDataSchema,
});

export type BackupEnvelope = z.infer<typeof backupEnvelopeSchema>;
export type BackupData = BackupEnvelope['data'];
export type ImportMode = 'merge' | 'replace';

export type ImportPreview = {
  backup: BackupEnvelope;
  summary: {
    schemaVersion: number;
    createdAt: string;
    totalRecords: number;
    tableCounts: Record<DatabaseTableName, number>;
    mergeConflictBehavior: 'imported-record-wins';
  };
};

export type ImportOptions = {
  mode: ImportMode;
  createBackupBeforeReplace?: boolean;
};

export type ImportResult = ImportPreview['summary'] & {
  mode: ImportMode;
  priorBackup?: BackupEnvelope;
};

export async function exportDatabase(
  database: FutCopilotDatabase,
): Promise<BackupEnvelope> {
  const [
    profiles,
    cardDefinitions,
    ownedCards,
    observations,
    personalTags,
    protectionRules,
    duplicateCases,
    sbcDefinitions,
    sbcProposals,
    marketObservations,
    marketTransactions,
    compatibilityRecords,
  ] = await Promise.all([
    database.profiles.toArray(),
    database.cardDefinitions.toArray(),
    database.ownedCards.toArray(),
    database.observations.toArray(),
    database.personalTags.toArray(),
    database.protectionRules.toArray(),
    database.duplicateCases.toArray(),
    database.sbcDefinitions.toArray(),
    database.sbcProposals.toArray(),
    database.marketObservations.toArray(),
    database.marketTransactions.toArray(),
    database.compatibilityRecords.toArray(),
  ]);

  return backupEnvelopeSchema.parse({
    format: 'fut-copilot-backup',
    schemaVersion: DATABASE_VERSION,
    createdAt: new Date().toISOString(),
    data: {
      profiles,
      cardDefinitions,
      ownedCards,
      observations,
      personalTags,
      protectionRules,
      duplicateCases,
      sbcDefinitions,
      sbcProposals,
      marketObservations,
      marketTransactions,
      compatibilityRecords,
    },
  });
}

export function previewImport(input: unknown): ImportPreview {
  const backup = backupEnvelopeSchema.parse(input);
  const tableCounts = Object.fromEntries(
    tableNames.map((tableName) => [tableName, backup.data[tableName].length]),
  ) as Record<DatabaseTableName, number>;

  return {
    backup,
    summary: {
      schemaVersion: backup.schemaVersion,
      createdAt: backup.createdAt,
      totalRecords: Object.values(tableCounts).reduce(
        (total, count) => total + count,
        0,
      ),
      tableCounts,
      mergeConflictBehavior: 'imported-record-wins',
    },
  };
}

export async function importDatabase(
  database: FutCopilotDatabase,
  input: unknown,
  options: ImportOptions,
): Promise<ImportResult> {
  const preview = previewImport(input);
  const priorBackup =
    options.mode === 'replace' && options.createBackupBeforeReplace === true
      ? await exportDatabase(database)
      : undefined;

  await database.transaction('rw', database.tables, async () => {
    if (options.mode === 'replace') {
      await Promise.all(database.tables.map((table) => table.clear()));
    }

    for (const tableName of tableNames) {
      const records = preview.backup.data[tableName];
      if (records.length > 0) {
        await database.table(tableName).bulkPut(records);
      }
    }
  });

  return {
    ...preview.summary,
    mode: options.mode,
    ...(priorBackup === undefined ? {} : { priorBackup }),
  };
}
