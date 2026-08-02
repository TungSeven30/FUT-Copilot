import type { AdapterSnapshot } from '@fut-copilot/domain/messages';

export function selectedCardFromSnapshot(snapshot: AdapterSnapshot | null) {
  if (snapshot?.state !== 'ready') return null;
  if (
    snapshot.event.type === 'card.selected' &&
    snapshot.event.payload.card !== null
  ) {
    return {
      card: snapshot.event.payload.card,
      location: 'club' as const,
      newOwnershipStatus: 'owned' as const,
    };
  }
  if (
    snapshot.event.type === 'marketContext.visible' &&
    snapshot.event.payload.selectedCard !== null
  ) {
    const isTransferMarket =
      snapshot.event.payload.selectedCard.tradeability.evidence?.includes(
        'visible-transfer-market-context',
      ) === true;
    if (isTransferMarket) return null;
    return {
      card: snapshot.event.payload.selectedCard,
      location: 'transfer-list' as const,
      newOwnershipStatus: 'unknown' as const,
    };
  }
  return null;
}
