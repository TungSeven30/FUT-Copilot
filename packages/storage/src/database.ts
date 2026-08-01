import type { NormalizedAdapterEvent } from '@fut-copilot/domain/adapter-events';
import type { CardDefinition, OwnedCard } from '@fut-copilot/domain/cards';
import type {
  PersonalProfile,
  PersonalTag,
  ProtectionRule,
} from '@fut-copilot/domain/profile';
import type {
  CompatibilityRecord,
  DuplicateCase,
  MarketObservation,
  MarketTransaction,
  SbcDefinition,
  SbcProposal,
} from '@fut-copilot/domain/workflows';
import Dexie, { type EntityTable } from 'dexie';

export const DATABASE_VERSION = 2;
export const DEFAULT_DATABASE_NAME = 'fut-copilot';

export const tableNames = [
  'profiles',
  'cardDefinitions',
  'ownedCards',
  'observations',
  'personalTags',
  'protectionRules',
  'duplicateCases',
  'sbcDefinitions',
  'sbcProposals',
  'marketObservations',
  'marketTransactions',
  'compatibilityRecords',
] as const;

export type DatabaseTableName = (typeof tableNames)[number];

export const databaseStores = {
  profiles: '&id, platform, updatedAt',
  cardDefinitions: '&id, fcYear, updatedAt',
  ownedCards:
    '&id, cardDefinitionId, profileId, location, tradeability, [profileId+cardDefinitionId]',
  observations: '&eventId, type, occurredAt, adapterVersion',
  personalTags: '&id, profileId, name, protectsCard',
  protectionRules: '&id, profileId, enabled, priority',
  duplicateCases: '&id, profileId, cardDefinitionId, state, detectedAt',
  sbcDefinitions: '&id, fcYear, name, segmentName, observedAt',
  sbcProposals: '&id, profileId, sbcDefinitionId, state, createdAt',
  marketObservations: '&id, profileId, cardDefinitionId, platform, observedAt',
  marketTransactions:
    '&id, profileId, cardDefinitionId, transactionType, occurredAt',
  compatibilityRecords:
    '&id, adapterVersion, fcYear, routeFamily, result, testedAt',
} as const;

type LegacyRecord = Record<string, unknown>;

function migrateDuplicateCase(record: LegacyRecord): void {
  if (record.state === 'open') record.state = 'detected';
  if (record.updatedAt === undefined) record.updatedAt = record.detectedAt;
}

function migrateSbcProposal(record: LegacyRecord): void {
  const candidateIds = Array.isArray(record.candidateOwnedCardIds)
    ? record.candidateOwnedCardIds
    : [];
  if (record.requiredPlayers === undefined) {
    record.requiredPlayers = Math.max(1, candidateIds.length || 11);
  }
  if (record.requiredRating === undefined) {
    record.requiredRating =
      typeof record.estimatedRating === 'number' ? record.estimatedRating : 1;
  }
  if (record.strategy === undefined) record.strategy = 'club-preservation';
  if (record.independentlyValidated === undefined) {
    record.independentlyValidated = false;
  }
  if (Array.isArray(record.warnings)) {
    record.warnings = [
      ...record.warnings,
      'Migrated from schema v1; validate this proposal again.',
    ];
  }
}

function migrateMarketTransaction(record: LegacyRecord): void {
  const transactionTypeMap: Record<string, string> = {
    purchase: 'purchased',
    sale: 'sold',
    listing: 'listed',
    'expired-listing': 'expired',
  };
  if (typeof record.transactionType === 'string') {
    record.transactionType =
      transactionTypeMap[record.transactionType] ?? record.transactionType;
  }
}

export class FutCopilotDatabase extends Dexie {
  profiles!: EntityTable<PersonalProfile, 'id'>;
  cardDefinitions!: EntityTable<CardDefinition, 'id'>;
  ownedCards!: EntityTable<OwnedCard, 'id'>;
  observations!: EntityTable<NormalizedAdapterEvent, 'eventId'>;
  personalTags!: EntityTable<PersonalTag, 'id'>;
  protectionRules!: EntityTable<ProtectionRule, 'id'>;
  duplicateCases!: EntityTable<DuplicateCase, 'id'>;
  sbcDefinitions!: EntityTable<SbcDefinition, 'id'>;
  sbcProposals!: EntityTable<SbcProposal, 'id'>;
  marketObservations!: EntityTable<MarketObservation, 'id'>;
  marketTransactions!: EntityTable<MarketTransaction, 'id'>;
  compatibilityRecords!: EntityTable<CompatibilityRecord, 'id'>;

  constructor(name = DEFAULT_DATABASE_NAME) {
    super(name);

    this.version(1).stores(databaseStores);
    this.version(DATABASE_VERSION)
      .stores(databaseStores)
      .upgrade(async (transaction) => {
        await transaction
          .table('duplicateCases')
          .toCollection()
          .modify(migrateDuplicateCase);
        await transaction
          .table('sbcProposals')
          .toCollection()
          .modify(migrateSbcProposal);
        await transaction
          .table('marketTransactions')
          .toCollection()
          .modify(migrateMarketTransaction);
      });
  }
}
