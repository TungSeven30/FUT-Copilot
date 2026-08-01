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

export const DATABASE_VERSION = 1;
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

    this.version(DATABASE_VERSION).stores({
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
      marketObservations:
        '&id, profileId, cardDefinitionId, platform, observedAt',
      marketTransactions:
        '&id, profileId, cardDefinitionId, transactionType, occurredAt',
      compatibilityRecords:
        '&id, adapterVersion, fcYear, routeFamily, result, testedAt',
    });
  }
}
