import type { NormalizedAdapterEvent } from '@fut-copilot/domain/adapter-events';

function observationFact<TValue>(observation: {
  status: string;
  value: TValue | null;
}) {
  return {
    status: observation.status,
    value: observation.value,
  };
}

export function createAdapterEventSignature(
  event: NormalizedAdapterEvent,
): string {
  if (event.type === 'card.selected') {
    const card = event.payload.card;
    if (card === null) {
      return `card.selected:${event.payload.screen}:empty`;
    }

    return JSON.stringify({
      type: event.type,
      screen: event.payload.screen,
      name: observationFact(card.name),
      overall: observationFact(card.overall),
      position: observationFact(card.position),
      rarity: observationFact(card.rarity),
      tradeability: observationFact(card.tradeability),
      firstOwner: observationFact(card.firstOwner),
      loan: observationFact(card.loan),
      faceStats: card.faceStats,
    });
  }

  if (event.type === 'adapter.degraded') {
    return JSON.stringify({
      type: event.type,
      screen: event.payload.screen,
      reasonCodes: [...event.payload.reasonCodes].sort(),
    });
  }

  return `${event.type}:${event.occurredAt}`;
}
