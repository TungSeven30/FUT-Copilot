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

const legacyBackupDataSchema = z.object({
  profiles: z.array(z.unknown()),
  cardDefinitions: z.array(z.unknown()),
  ownedCards: z.array(z.unknown()),
  observations: z.array(z.unknown()),
  personalTags: z.array(z.unknown()),
  protectionRules: z.array(z.unknown()),
  duplicateCases: z.array(z.unknown()),
  sbcDefinitions: z.array(z.unknown()),
  sbcProposals: z.array(z.unknown()),
  marketObservations: z.array(z.unknown()),
  marketTransactions: z.array(z.unknown()),
  compatibilityRecords: z.array(z.unknown()),
});

const legacyBackupEnvelopeSchema = z.object({
  format: z.literal('fut-copilot-backup'),
  schemaVersion: z.literal(1),
  createdAt: isoDateTimeSchema,
  data: legacyBackupDataSchema,
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

function legacyRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Legacy backup record must be an object.');
  }
  return { ...(value as Record<string, unknown>) };
}

function migrateLegacyBackup(input: unknown): BackupEnvelope {
  const legacy = legacyBackupEnvelopeSchema.parse(input);
  const duplicateCases = legacy.data.duplicateCases.map((value) => {
    const record = legacyRecord(value);
    if (record.state === 'open') record.state = 'detected';
    if (record.updatedAt === undefined) record.updatedAt = record.detectedAt;
    return record;
  });
  const sbcProposals = legacy.data.sbcProposals.map((value) => {
    const record = legacyRecord(value);
    const candidateIds = Array.isArray(record.candidateOwnedCardIds)
      ? record.candidateOwnedCardIds
      : [];
    record.requiredPlayers = Math.max(1, candidateIds.length || 11);
    record.requiredRating =
      typeof record.estimatedRating === 'number' ? record.estimatedRating : 1;
    record.strategy = 'club-preservation';
    record.independentlyValidated = false;
    record.warnings = [
      ...(Array.isArray(record.warnings) ? record.warnings : []),
      'Migrated from schema v1; validate this proposal again.',
    ];
    return record;
  });
  const transactionTypeMap: Record<string, string> = {
    purchase: 'purchased',
    sale: 'sold',
    listing: 'listed',
    'expired-listing': 'expired',
  };
  const marketTransactions = legacy.data.marketTransactions.map((value) => {
    const record = legacyRecord(value);
    if (typeof record.transactionType === 'string') {
      record.transactionType =
        transactionTypeMap[record.transactionType] ?? record.transactionType;
    }
    return record;
  });

  return backupEnvelopeSchema.parse({
    format: legacy.format,
    schemaVersion: DATABASE_VERSION,
    createdAt: legacy.createdAt,
    data: {
      ...legacy.data,
      duplicateCases,
      sbcProposals,
      marketTransactions,
    },
  });
}

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
  const version = z
    .object({ schemaVersion: z.number().int() })
    .parse(input).schemaVersion;
  const backup =
    version === 1
      ? migrateLegacyBackup(input)
      : backupEnvelopeSchema.parse(input);
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
