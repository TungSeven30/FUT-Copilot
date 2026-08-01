import type { OwnedCard } from '@fut-copilot/domain/cards';
import type { PersonalTag } from '@fut-copilot/domain/profile';

export type SellingGuardResult = {
  warnings: Array<{
    code: 'protected-card' | 'below-personal-minimum' | 'tradeability-unknown';
    message: string;
    severity: 'warning' | 'critical';
  }>;
};

export function evaluateSellingGuard(input: {
  ownedCard: OwnedCard;
  tags: PersonalTag[];
  proposedListPrice: number;
  personalMinimum?: number;
}): SellingGuardResult {
  const selectedTags = input.tags.filter((tag) =>
    input.ownedCard.personalTagIds.includes(tag.id),
  );
  const warnings: SellingGuardResult['warnings'] = [];
  if (
    input.ownedCard.protected ||
    selectedTags.some((tag) => tag.protectsCard)
  ) {
    warnings.push({
      code: 'protected-card',
      message: 'This card is protected by your personal rules.',
      severity: 'critical',
    });
  }
  if (
    input.personalMinimum !== undefined &&
    input.proposedListPrice < input.personalMinimum
  ) {
    warnings.push({
      code: 'below-personal-minimum',
      message: `The proposed list price is below your ${input.personalMinimum.toLocaleString()} coin minimum.`,
      severity: 'critical',
    });
  }
  if (input.ownedCard.tradeability === 'unknown') {
    warnings.push({
      code: 'tradeability-unknown',
      message: 'Tradeability is unknown; confirm it in the EA Web App.',
      severity: 'warning',
    });
  }
  return { warnings };
}
