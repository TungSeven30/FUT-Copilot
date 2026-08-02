import type { CardDefinition } from './cards';
import type { CardIdentityFacts } from './identity';
import { resolveCardIdentity } from './identity';
import type { Observation } from './observation';

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

function makeFacts(): CardIdentityFacts {
  return {
    assetId: unknown(),
    resourceId: unknown(),
    name: known('Alex Example'),
    overall: known(91),
    position: known('ST'),
    club: unknown(),
    league: unknown(),
    nation: unknown(),
    rarity: known('special'),
  };
}

function makeDefinition(
  id: string,
  resourceId = unknown<string>(),
): CardDefinition {
  return {
    id,
    fcYear: 26,
    assetId: unknown(),
    resourceId,
    name: known('Alex Example'),
    overall: known(91),
    position: known('ST'),
    club: unknown(),
    league: unknown(),
    nation: unknown(),
    rarity: known('special'),
    promotion: unknown(),
    identityConfidence: 0.765,
    createdAt: observedAt,
    updatedAt: observedAt,
  };
}

describe('card identity resolution', () => {
  it('prefers an exact stable resource ID', () => {
    const facts = { ...makeFacts(), resourceId: known('resource-123') };
    const result = resolveCardIdentity(facts, [
      makeDefinition(
        '6b5ae0e3-633f-4b47-a2e2-85c8681d98f1',
        known('resource-123'),
      ),
    ]);

    expect(result.status).toBe('resolved');
    if (result.status === 'resolved') {
      expect(result.candidate.strategy).toBe('stable-resource-id');
      expect(result.candidate.confidence).toBe(1);
    }
  });

  it('never silently collapses multiple composite candidates', () => {
    const result = resolveCardIdentity(makeFacts(), [
      makeDefinition('2d54c169-92af-4318-8c8b-78b79295c2ba'),
      makeDefinition('7fd34173-da82-47d6-b813-c5709a305e94'),
    ]);

    expect(result.status).toBe('ambiguous');
    if (result.status === 'ambiguous') {
      expect(result.candidates).toHaveLength(2);
    }
  });

  it('rejects a conflicting known rarity', () => {
    const definition = {
      ...makeDefinition('89c0ba27-7592-4ad7-873b-b4c8260720f4'),
      rarity: known('rare'),
    };

    expect(resolveCardIdentity(makeFacts(), [definition]).status).toBe(
      'unmatched',
    );
  });
});
