import type { CardDefinition } from './cards';
import type { Observation } from './observation';

export type CardIdentityFacts = {
  assetId: Observation<string>;
  resourceId: Observation<string>;
  name: Observation<string>;
  overall: Observation<number>;
  position: Observation<string>;
  club: Observation<string>;
  league: Observation<string>;
  nation: Observation<string>;
  rarity: Observation<string>;
};

export type IdentityCandidate = {
  cardDefinition: CardDefinition;
  confidence: number;
  strategy: 'stable-resource-id' | 'asset-version' | 'composite';
  matchingFacts: string[];
  conflictingFacts: string[];
};

export type IdentityResolution =
  | { status: 'unmatched'; candidates: [] }
  | { status: 'resolved'; candidate: IdentityCandidate }
  | { status: 'ambiguous'; candidates: IdentityCandidate[] };

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function knownStringMatches(
  observed: Observation<string>,
  stored: Observation<string>,
): boolean | null {
  if (observed.value === null || stored.value === null) {
    return null;
  }
  return normalized(observed.value) === normalized(stored.value);
}

function knownNumberMatches(
  observed: Observation<number>,
  stored: Observation<number>,
): boolean | null {
  if (observed.value === null || stored.value === null) {
    return null;
  }
  return observed.value === stored.value;
}

function candidateFromFacts(
  facts: CardIdentityFacts,
  definition: CardDefinition,
): IdentityCandidate | null {
  const resourceIdMatches = knownStringMatches(
    facts.resourceId,
    definition.resourceId,
  );
  if (resourceIdMatches === true) {
    return {
      cardDefinition: definition,
      confidence: 1,
      strategy: 'stable-resource-id',
      matchingFacts: ['resource-id'],
      conflictingFacts: [],
    };
  }

  if (resourceIdMatches === false) {
    return null;
  }

  const nameMatches = knownStringMatches(facts.name, definition.name);
  const overallMatches = knownNumberMatches(facts.overall, definition.overall);
  const positionMatches = knownStringMatches(
    facts.position,
    definition.position,
  );
  if (
    nameMatches !== true ||
    overallMatches !== true ||
    positionMatches !== true
  ) {
    return null;
  }

  const matchingFacts = ['name', 'overall', 'position'];
  const conflictingFacts: string[] = [];
  const optionalFacts = [
    ['rarity', knownStringMatches(facts.rarity, definition.rarity)],
    ['club', knownStringMatches(facts.club, definition.club)],
    ['league', knownStringMatches(facts.league, definition.league)],
    ['nation', knownStringMatches(facts.nation, definition.nation)],
  ] as const;

  for (const [label, matches] of optionalFacts) {
    if (matches === true) {
      matchingFacts.push(label);
    } else if (matches === false) {
      conflictingFacts.push(label);
    }
  }

  if (conflictingFacts.length > 0) {
    return null;
  }

  const assetIdMatches = knownStringMatches(facts.assetId, definition.assetId);
  const hasVersionFact = matchingFacts.includes('rarity');
  if (assetIdMatches === true && hasVersionFact) {
    return {
      cardDefinition: definition,
      confidence: 0.94,
      strategy: 'asset-version',
      matchingFacts: ['asset-id', ...matchingFacts],
      conflictingFacts,
    };
  }

  return {
    cardDefinition: definition,
    confidence: Math.min(0.9, 0.72 + (matchingFacts.length - 3) * 0.045),
    strategy: 'composite',
    matchingFacts,
    conflictingFacts,
  };
}

export function resolveCardIdentity(
  facts: CardIdentityFacts,
  definitions: CardDefinition[],
): IdentityResolution {
  const candidates = definitions
    .map((definition) => candidateFromFacts(facts, definition))
    .filter((candidate): candidate is IdentityCandidate => candidate !== null)
    .sort((left, right) => right.confidence - left.confidence);

  if (candidates.length === 0) {
    return { status: 'unmatched', candidates: [] };
  }

  const best = candidates[0];
  if (candidates.length === 1 && best !== undefined) {
    return { status: 'resolved', candidate: best };
  }

  return { status: 'ambiguous', candidates };
}
