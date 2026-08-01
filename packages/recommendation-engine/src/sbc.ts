import type { CardDefinition, OwnedCard } from '@fut-copilot/domain/cards';
import type { PersonalTag } from '@fut-copilot/domain/profile';
import {
  sbcProposalSchema,
  type SbcProposal,
} from '@fut-copilot/domain/workflows';

export type SbcPlannerStrategy = SbcProposal['strategy'];

export type SbcPlannerCard = {
  ownedCard: OwnedCard;
  definition: CardDefinition;
  tags: PersonalTag[];
  duplicate: boolean;
  coinEquivalent?: number;
};

export type RatingOnlyPlan = {
  selected: SbcPlannerCard[];
  selectionReasons: Array<{
    ownedCardId: string;
    reason: string;
    confidence: number;
  }>;
  excludedProtectedCardIds: string[];
  estimatedRating: number | null;
  overshoot: number | null;
  valid: boolean;
  warnings: string[];
};

export type ParsedRatingOnlyRequirements = {
  supported: boolean;
  requiredPlayers: number | null;
  requiredRating: number | null;
  unsupportedLabels: string[];
};

const PLAYER_COUNT_PATTERN = /\bplayers?\s*:?\s*(?:min\.?\s*)?(\d+)\b/i;
const RATING_PATTERN = /(?:team\s+overall\s+rating|squad\s+rating)[^\d]*(\d+)/i;

export function parseRatingOnlyRequirements(
  labels: string[],
): ParsedRatingOnlyRequirements {
  let requiredPlayers: number | null = null;
  let requiredRating: number | null = null;
  const unsupportedLabels: string[] = [];

  for (const label of labels) {
    const playerMatch = PLAYER_COUNT_PATTERN.exec(label);
    const ratingMatch = RATING_PATTERN.exec(label);
    if (playerMatch?.[1] !== undefined) {
      requiredPlayers = Number.parseInt(playerMatch[1], 10);
    } else if (ratingMatch?.[1] !== undefined) {
      requiredRating = Number.parseInt(ratingMatch[1], 10);
    } else if (/chemistry|league|nation|club|rarity|quality/i.test(label)) {
      unsupportedLabels.push(label);
    }
  }

  return {
    supported:
      requiredPlayers !== null &&
      requiredRating !== null &&
      unsupportedLabels.length === 0,
    requiredPlayers,
    requiredRating,
    unsupportedLabels,
  };
}

export function calculateSquadRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((total, rating) => total + rating, 0);
  const average = sum / ratings.length;
  const correction = ratings.reduce(
    (total, rating) => total + Math.max(0, rating - average),
    0,
  );
  return Math.floor((sum + correction) / ratings.length);
}

function isProtected(card: SbcPlannerCard): boolean {
  if (card.ownedCard.protected) return true;
  return card.tags.some(
    (tag) => tag.protectsCard && card.ownedCard.personalTagIds.includes(tag.id),
  );
}

function burnCost(card: SbcPlannerCard, strategy: SbcPlannerStrategy): number {
  const activeSquadPenalty =
    card.ownedCard.location === 'active-squad' ? 1_000_000 : 0;
  const tradeablePenalty =
    card.ownedCard.tradeability === 'tradeable' ? 5_000 : 0;
  const coinCost = card.coinEquivalent ?? 0;
  const fodder = card.tags.some(
    (tag) =>
      tag.name.toLocaleLowerCase('en-US') === 'fodder' &&
      card.ownedCard.personalTagIds.includes(tag.id),
  );
  const duplicateBonus = card.duplicate ? -100_000 : 0;
  const fodderBonus = fodder ? -50_000 : 0;

  if (strategy === 'duplicate-cleanup') {
    return activeSquadPenalty + coinCost + duplicateBonus + fodderBonus;
  }
  if (strategy === 'low-coin-cost') {
    return activeSquadPenalty + tradeablePenalty + coinCost + fodderBonus;
  }
  return (
    activeSquadPenalty +
    tradeablePenalty +
    coinCost +
    duplicateBonus / 2 +
    fodderBonus
  );
}

function knownRating(card: SbcPlannerCard): number | null {
  return card.definition.overall.value;
}

function explainSelection(
  card: SbcPlannerCard,
  strategy: SbcPlannerStrategy,
): RatingOnlyPlan['selectionReasons'][number] {
  const taggedFodder = card.tags.some(
    (tag) =>
      tag.name.toLocaleLowerCase('en-US') === 'fodder' &&
      card.ownedCard.personalTagIds.includes(tag.id),
  );
  if (card.duplicate && strategy === 'duplicate-cleanup') {
    return {
      ownedCardId: card.ownedCard.id,
      reason: 'Duplicate prioritized for cleanup',
      confidence: 0.95,
    };
  }
  if (taggedFodder) {
    return {
      ownedCardId: card.ownedCard.id,
      reason: 'Personal fodder tag matches the strategy',
      confidence: 0.9,
    };
  }
  if (card.ownedCard.tradeability === 'untradeable') {
    return {
      ownedCardId: card.ownedCard.id,
      reason: 'Untradeable card fits the rating target',
      confidence: 0.8,
    };
  }
  return {
    ownedCardId: card.ownedCard.id,
    reason: 'Rating fit selected by the chosen strategy',
    confidence: card.ownedCard.tradeability === 'unknown' ? 0.6 : 0.7,
  };
}

export function validateRatingOnlyPlan(
  selected: SbcPlannerCard[],
  requiredPlayers: number,
  requiredRating: number,
): { valid: boolean; rating: number | null; warnings: string[] } {
  const warnings: string[] = [];
  if (selected.length !== requiredPlayers) {
    warnings.push(
      `Expected ${requiredPlayers} players but selected ${selected.length}.`,
    );
  }
  const ratings = selected.map(knownRating);
  if (ratings.some((rating) => rating === null)) {
    warnings.push('At least one selected card has an unknown rating.');
  }
  const protectedCount = selected.filter(isProtected).length;
  if (protectedCount > 0) {
    warnings.push(`${protectedCount} protected card(s) must be removed.`);
  }
  const knownRatings = ratings.filter(
    (rating): rating is number => rating !== null,
  );
  const rating =
    knownRatings.length === selected.length && selected.length > 0
      ? calculateSquadRating(knownRatings)
      : null;
  if (rating !== null && rating < requiredRating) {
    warnings.push(`Squad rating ${rating} is below ${requiredRating}.`);
  }

  return {
    valid:
      selected.length === requiredPlayers &&
      protectedCount === 0 &&
      rating !== null &&
      rating >= requiredRating,
    rating,
    warnings,
  };
}

export function planRatingOnlySbc(input: {
  cards: SbcPlannerCard[];
  requiredPlayers: number;
  requiredRating: number;
  strategy: SbcPlannerStrategy;
}): RatingOnlyPlan {
  const excludedProtectedCardIds = input.cards
    .filter(isProtected)
    .map((card) => card.ownedCard.id);
  const eligible = input.cards.filter(
    (card) => !isProtected(card) && knownRating(card) !== null,
  );
  if (eligible.length < input.requiredPlayers) {
    return {
      selected: [],
      selectionReasons: [],
      excludedProtectedCardIds,
      estimatedRating: null,
      overshoot: null,
      valid: false,
      warnings: [
        `Only ${eligible.length} eligible known cards are available locally.`,
      ],
    };
  }

  let selected = [...eligible]
    .sort((left, right) => (knownRating(right) ?? 0) - (knownRating(left) ?? 0))
    .slice(0, input.requiredPlayers);
  let validation = validateRatingOnlyPlan(
    selected,
    input.requiredPlayers,
    input.requiredRating,
  );
  if (!validation.valid) {
    return {
      selected,
      selectionReasons: selected.map((card) =>
        explainSelection(card, input.strategy),
      ),
      excludedProtectedCardIds,
      estimatedRating: validation.rating,
      overshoot:
        validation.rating === null
          ? null
          : validation.rating - input.requiredRating,
      valid: false,
      warnings: validation.warnings,
    };
  }

  const selectedIds = new Set(selected.map((card) => card.ownedCard.id));
  const alternatives = eligible
    .filter((card) => !selectedIds.has(card.ownedCard.id))
    .sort(
      (left, right) =>
        burnCost(left, input.strategy) - burnCost(right, input.strategy),
    );

  for (const alternative of alternatives) {
    const replaceable = [...selected].sort(
      (left, right) =>
        burnCost(right, input.strategy) - burnCost(left, input.strategy),
    );
    for (const current of replaceable) {
      if (
        burnCost(alternative, input.strategy) >=
        burnCost(current, input.strategy)
      ) {
        continue;
      }
      const proposed = selected.map((card) =>
        card.ownedCard.id === current.ownedCard.id ? alternative : card,
      );
      const proposedValidation = validateRatingOnlyPlan(
        proposed,
        input.requiredPlayers,
        input.requiredRating,
      );
      if (proposedValidation.valid) {
        selected = proposed;
        validation = proposedValidation;
        break;
      }
    }
  }

  return {
    selected,
    selectionReasons: selected.map((card) =>
      explainSelection(card, input.strategy),
    ),
    excludedProtectedCardIds,
    estimatedRating: validation.rating,
    overshoot:
      validation.rating === null
        ? null
        : validation.rating - input.requiredRating,
    valid: validation.valid,
    warnings: [
      ...validation.warnings,
      'Proposal uses only locally observed cards; club coverage may be partial.',
    ],
  };
}

export function createSbcProposal(input: {
  profileId: string;
  sbcDefinitionId: string;
  requiredPlayers: number;
  requiredRating: number;
  strategy: SbcPlannerStrategy;
  plan: RatingOnlyPlan;
  createId?: () => string;
  now?: () => Date;
}): SbcProposal {
  return sbcProposalSchema.parse({
    id: (input.createId ?? (() => crypto.randomUUID()))(),
    profileId: input.profileId,
    sbcDefinitionId: input.sbcDefinitionId,
    candidateOwnedCardIds: input.plan.selected.map((card) => card.ownedCard.id),
    excludedProtectedCardIds: input.plan.excludedProtectedCardIds,
    ...(input.plan.estimatedRating === null
      ? {}
      : { estimatedRating: input.plan.estimatedRating }),
    requiredPlayers: input.requiredPlayers,
    requiredRating: input.requiredRating,
    strategy: input.strategy,
    independentlyValidated: input.plan.valid,
    warnings: input.plan.warnings,
    state: 'draft',
    createdAt: (input.now ?? (() => new Date()))().toISOString(),
  });
}
