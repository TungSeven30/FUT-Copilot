import type { CardDefinition, OwnedCard } from '@fut-copilot/domain/cards';
import type { PersonalTag } from '@fut-copilot/domain/profile';
import {
  recommendationSchema,
  type Recommendation,
} from '@fut-copilot/domain/workflows';

import type { MarketCalculation } from './market';

export type RecommendationModel = {
  model: 'keep' | 'sell' | 'sbc';
  score: number;
  confidence: number;
  reasons: Recommendation['reasons'];
};

export type CardRecommendationResult = {
  primary: Recommendation;
  models: [RecommendationModel, RecommendationModel, RecommendationModel];
};

function hasTag(tags: PersonalTag[], ownedCard: OwnedCard, name: string) {
  const normalized = name.toLocaleLowerCase('en-US');
  return tags.some(
    (tag) =>
      ownedCard.personalTagIds.includes(tag.id) &&
      tag.name.toLocaleLowerCase('en-US') === normalized,
  );
}

function knownOverall(definition: CardDefinition): number | null {
  return definition.overall.value;
}

export function evaluateKeepModel(input: {
  definition: CardDefinition;
  ownedCard: OwnedCard;
  tags: PersonalTag[];
}): RecommendationModel {
  const overall = knownOverall(input.definition);
  const favorite = hasTag(input.tags, input.ownedCard, 'favorite');
  const evo = hasTag(input.tags, input.ownedCard, 'Evo project');
  const reasons: Recommendation['reasons'] = [];
  let score = 0.25;

  if (favorite) {
    score += 0.55;
    reasons.push({
      code: 'favorite-tag',
      summary: 'Personal favorite',
      detail: 'You marked this card as a favorite.',
      impact: 0.55,
      factStatus: 'known',
    });
  }
  if (evo) {
    score += 0.45;
    reasons.push({
      code: 'evo-project-tag',
      summary: 'Evolution project',
      detail: 'The card is part of your personal Evolution plans.',
      impact: 0.45,
      factStatus: 'known',
    });
  }
  if (overall !== null) {
    const impact = Math.max(-0.15, Math.min(0.3, (overall - 84) / 30));
    score += impact;
    reasons.push({
      code: 'overall-known',
      summary: `${overall} overall`,
      detail: 'Known overall contributes to general squad and club utility.',
      impact,
      factStatus: input.definition.overall.status,
    });
  }
  if (input.ownedCard.firstOwner.value === true) {
    score += 0.08;
    reasons.push({
      code: 'first-owner',
      summary: 'First owner',
      detail: 'First-owner status slightly favors keeping the card.',
      impact: 0.08,
      factStatus: input.ownedCard.firstOwner.status,
    });
  }

  return {
    model: 'keep',
    score: Math.max(0, Math.min(1, score)),
    confidence: overall === null ? 0.45 : 0.75,
    reasons,
  };
}

export function evaluateSellModel(input: {
  ownedCard: OwnedCard;
  tags: PersonalTag[];
  market: MarketCalculation;
}): RecommendationModel {
  const reasons: Recommendation['reasons'] = [];
  let score = 0.15;
  let confidence = 0.4;

  if (input.ownedCard.tradeability === 'tradeable') {
    score += 0.35;
    confidence += 0.2;
    reasons.push({
      code: 'tradeable',
      summary: 'Tradeable copy',
      detail: 'A manual sale is available according to the visible UI.',
      impact: 0.35,
      factStatus: 'inferred',
    });
  } else if (input.ownedCard.tradeability === 'unknown') {
    confidence -= 0.15;
    reasons.push({
      code: 'tradeability-unknown',
      summary: 'Tradeability unknown',
      detail: 'No sale recommendation can rely on missing tradeability.',
      impact: -0.35,
      factStatus: 'unknown',
    });
  } else {
    score = 0;
    reasons.push({
      code: 'untradeable',
      summary: 'Untradeable copy',
      detail: 'This copy cannot be sold on the transfer market.',
      impact: -1,
      factStatus: 'known',
    });
  }

  if (input.market.expectedNetProceeds !== null) {
    score += 0.25;
    confidence += input.market.observationStatus === 'fresh' ? 0.2 : 0.05;
    reasons.push({
      code: 'manual-price-known',
      summary: `${input.market.expectedNetProceeds.toLocaleString()} net coins`,
      detail: 'This uses your manual PlayStation price and configured tax.',
      impact: 0.25,
      factStatus:
        input.market.observationStatus === 'stale' ? 'stale' : 'known',
    });
  } else {
    confidence -= 0.1;
    reasons.push({
      code: 'price-missing',
      summary: 'Price missing',
      detail: 'Enter a PlayStation price before relying on a sale decision.',
      impact: -0.2,
      factStatus: 'unknown',
    });
  }

  if (hasTag(input.tags, input.ownedCard, 'investment')) {
    score -= 0.15;
    reasons.push({
      code: 'investment-tag',
      summary: 'Investment hold',
      detail: 'Your investment tag favors reviewing the target before selling.',
      impact: -0.15,
      factStatus: 'known',
    });
  }

  return {
    model: 'sell',
    score: Math.max(0, Math.min(1, score)),
    confidence: Math.max(0, Math.min(1, confidence)),
    reasons,
  };
}

export function evaluateSbcModel(input: {
  definition: CardDefinition;
  ownedCard: OwnedCard;
  tags: PersonalTag[];
}): RecommendationModel {
  const reasons: Recommendation['reasons'] = [];
  const overall = knownOverall(input.definition);
  let score = 0.1;
  let confidence = overall === null ? 0.35 : 0.7;

  if (hasTag(input.tags, input.ownedCard, 'fodder')) {
    score += 0.55;
    reasons.push({
      code: 'fodder-tag',
      summary: 'Marked as fodder',
      detail: 'Your explicit fodder tag favors SBC use.',
      impact: 0.55,
      factStatus: 'known',
    });
  }
  if (overall !== null) {
    const impact = overall >= 87 ? 0.25 : 0.08;
    score += impact;
    reasons.push({
      code: 'sbc-rating-utility',
      summary: `${overall} rating utility`,
      detail: 'Rating contributes to rating-only SBC requirements.',
      impact,
      factStatus: input.definition.overall.status,
    });
  }
  if (input.ownedCard.tradeability === 'untradeable') {
    score += 0.15;
    reasons.push({
      code: 'untradeable-sbc-utility',
      summary: 'Untradeable club value',
      detail: 'SBC use may unlock value that a sale cannot.',
      impact: 0.15,
      factStatus: 'known',
    });
  } else if (input.ownedCard.tradeability === 'unknown') {
    confidence -= 0.1;
    reasons.push({
      code: 'sbc-tradeability-unknown',
      summary: 'Tradeability unknown',
      detail: 'Confirm tradeability before burning possible coin value.',
      impact: -0.15,
      factStatus: 'unknown',
    });
  }

  return {
    model: 'sbc',
    score: Math.max(0, Math.min(1, score)),
    confidence: Math.max(0, Math.min(1, confidence)),
    reasons,
  };
}

export function recommendCard(input: {
  definition: CardDefinition;
  ownedCard: OwnedCard;
  tags: PersonalTag[];
  market: MarketCalculation;
  createId?: () => string;
  now?: () => Date;
}): CardRecommendationResult {
  const keep = evaluateKeepModel(input);
  const sell = evaluateSellModel(input);
  const sbc = evaluateSbcModel(input);
  const models: CardRecommendationResult['models'] = [keep, sell, sbc];
  const selectedTags = input.tags.filter((tag) =>
    input.ownedCard.personalTagIds.includes(tag.id),
  );
  const protectedByRule =
    input.ownedCard.protected ||
    selectedTags.some((tag) => tag.protectsCard === true);
  let action: Recommendation['action'];
  let confidence: number;
  let reasons: Recommendation['reasons'];

  if (protectedByRule) {
    action = 'protect';
    confidence = 1;
    reasons = [
      {
        code: 'protection-override',
        summary: 'Protected by your rules',
        detail: 'Protection overrides every numeric keep, sell, or SBC score.',
        impact: 1,
        factStatus: 'known',
      },
      {
        code: 'manual-action-required',
        summary: 'Manual action only',
        detail:
          'FUT Copilot will warn but never move, list, or submit the card.',
        impact: 0.2,
        factStatus: 'known',
      },
    ];
  } else {
    const best = [...models].sort((left, right) => right.score - left.score)[0];
    if (best === undefined) {
      throw new Error('Recommendation models were unavailable.');
    }
    action =
      best.model === 'keep'
        ? 'keep'
        : best.model === 'sell'
          ? 'sell'
          : 'use-in-sbc';
    confidence = best.confidence;
    reasons = best.reasons.length > 0 ? best.reasons : sell.reasons;
  }

  return {
    primary: recommendationSchema.parse({
      id: (input.createId ?? (() => crypto.randomUUID()))(),
      subjectType: 'owned-card',
      subjectId: input.ownedCard.id,
      action,
      confidence,
      reasons,
      generatedAt: (input.now ?? (() => new Date()))().toISOString(),
    }),
    models,
  };
}
