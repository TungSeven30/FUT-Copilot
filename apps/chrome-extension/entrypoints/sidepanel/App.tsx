import { createFutggResearchLink } from '@fut-copilot/domain/futgg';
import type { VisibleCard } from '@fut-copilot/domain/adapter-events';
import {
  adapterAcknowledgeResponseSchema,
  adapterSnapshotChangedMessageSchema,
  adapterSnapshotResponseSchema,
  type AdapterSnapshot,
} from '@fut-copilot/domain/messages';
import { personalProfileSchema } from '@fut-copilot/domain/profile';
import {
  sbcDefinitionSchema,
  type DuplicateCase,
  type MarketObservation,
  type MarketTransaction,
  type SbcProposal,
} from '@fut-copilot/domain/workflows';
import { ADAPTER_VERSION } from '@fut-copilot/ea-web-adapter/adapter-version';
import {
  calculateMarket,
  summarizeMarketJournal,
  type MarketCalculation,
} from '@fut-copilot/recommendation-engine/market';
import {
  recommendCard,
  type CardRecommendationResult,
} from '@fut-copilot/recommendation-engine/recommendations';
import {
  createSbcProposal,
  parseRatingOnlyRequirements,
  planRatingOnlySbc,
  type SbcPlannerCard,
  type SbcPlannerStrategy,
} from '@fut-copilot/recommendation-engine/sbc';
import { evaluateSellingGuard } from '@fut-copilot/recommendation-engine/selling-guard';
import {
  exportDatabase,
  importDatabase,
  previewImport,
  type ImportPreview,
} from '@fut-copilot/storage/backup';
import { FutCopilotDatabase } from '@fut-copilot/storage/database';
import {
  resolveDuplicateCase,
  updateDuplicateCaseState,
} from '@fut-copilot/storage/duplicates';
import {
  getMarketTransactions,
  recordMarketTransaction,
} from '@fut-copilot/storage/market-journal';
import {
  DEFAULT_PROFILE_ID,
  ensureDefaultProfile,
  ensureSelectedCardContext,
  getLatestMarketObservation,
  recordManualMarketObservation,
  updateOwnedCardPersonalization,
  updateOwnedCardPurchasePrice,
  type PersonalizedCardContext,
} from '@fut-copilot/storage/personalization';
import {
  getDuplicateQueueRows,
  getAdapterDiagnostics,
  getSbcInventory,
  getTableCounts,
  scanVisibleCardProtection,
  savePersonalProfile,
  saveSbcProposal,
  type AdapterDiagnostics,
  type DuplicateQueueRow,
  type VisibleCardProtectionResult,
} from '@fut-copilot/storage/workspaces';
import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

import { selectedCardFromSnapshot } from './selected-context';

const database = new FutCopilotDatabase();

type PanelState =
  | { kind: 'loading' }
  | { kind: 'disconnected' }
  | { kind: 'snapshot'; snapshot: AdapterSnapshot }
  | { kind: 'error'; reason: string };

type ObservationValue = {
  status: 'known' | 'inferred' | 'unknown' | 'stale';
  value: boolean | number | string | null;
};

type WorkspaceReady = {
  context: PersonalizedCardContext & {
    cardDefinition: NonNullable<PersonalizedCardContext['cardDefinition']>;
    ownedCard: NonNullable<PersonalizedCardContext['ownedCard']>;
  };
  latestMarketObservation: MarketObservation | null;
  market: MarketCalculation;
  recommendation: CardRecommendationResult;
};

type WorkspaceState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ambiguous'; context: PersonalizedCardContext }
  | { kind: 'ready'; value: WorkspaceReady }
  | { kind: 'error'; reason: string };

function snapshotIsNewer(current: PanelState, next: AdapterSnapshot): boolean {
  return (
    current.kind !== 'snapshot' || next.updatedAt >= current.snapshot.updatedAt
  );
}

function useAdapterPanelState() {
  const [state, setState] = useState<PanelState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    const onMessage = (message: unknown) => {
      const parsed = adapterSnapshotChangedMessageSchema.safeParse(message);
      if (!active || !parsed.success) {
        return undefined;
      }

      setState((current) =>
        snapshotIsNewer(current, parsed.data.snapshot)
          ? { kind: 'snapshot', snapshot: parsed.data.snapshot }
          : current,
      );
      return undefined;
    };

    browser.runtime.onMessage.addListener(onMessage);
    void browser.runtime
      .sendMessage({ kind: 'adapter.snapshot.get' })
      .then((response) => {
        const parsed = adapterSnapshotResponseSchema.parse(response);
        if (!active) return;

        setState((current) => {
          if (parsed.snapshot === null) {
            return current.kind === 'snapshot'
              ? current
              : { kind: 'disconnected' };
          }
          return snapshotIsNewer(current, parsed.snapshot)
            ? { kind: 'snapshot', snapshot: parsed.snapshot }
            : current;
        });
      })
      .catch(() => {
        if (active) {
          setState({ kind: 'error', reason: 'snapshot-request-failed' });
        }
      });

    return () => {
      active = false;
      browser.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  const observeVisibleContext = useCallback(() => {
    setState({ kind: 'loading' });
    void browser.runtime
      .sendMessage({ kind: 'adapter.observe.request' })
      .then((response) => {
        const acknowledgement =
          adapterAcknowledgeResponseSchema.parse(response);
        if (!acknowledgement.accepted) {
          setState({
            kind: 'error',
            reason: acknowledgement.reason ?? 'observation-not-accepted',
          });
        }
      })
      .catch(() => {
        setState({ kind: 'error', reason: 'observation-request-failed' });
      });
  }, []);

  return { state, observeVisibleContext };
}

function useCardWorkspace(snapshot: AdapterSnapshot | null) {
  const [result, setResult] = useState<{
    key: string;
    state: WorkspaceState;
  } | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const selected = selectedCardFromSnapshot(snapshot);
  const card = selected?.card ?? null;
  const selectedLocation = selected?.location ?? 'club';
  const selectedOwnershipStatus = selected?.newOwnershipStatus ?? 'owned';
  const loadKey = `${card?.localObservationId ?? 'idle'}:${selectedLocation}:${selectedOwnershipStatus}:${snapshot?.updatedAt ?? 'none'}:${reloadVersion}`;

  useEffect(() => {
    let active = true;
    if (card === null) {
      return () => {
        active = false;
      };
    }

    void ensureSelectedCardContext(database, card, {
      location: selectedLocation,
      newOwnershipStatus: selectedOwnershipStatus,
    })
      .then(async (context) => {
        if (!active) return;
        if (
          context.identity.status === 'ambiguous' ||
          context.cardDefinition === null ||
          context.ownedCard === null
        ) {
          setResult({
            key: loadKey,
            state: { kind: 'ambiguous', context },
          });
          return;
        }

        const latestMarketObservation = await getLatestMarketObservation(
          database,
          context.cardDefinition.id,
        );
        const market = calculateMarket({
          ...(latestMarketObservation === null
            ? {}
            : {
                observedPrice: latestMarketObservation.amount,
                observedAt: latestMarketObservation.observedAt,
              }),
          ...(context.ownedCard.purchasePrice?.value === undefined ||
          context.ownedCard.purchasePrice.value === null
            ? {}
            : { purchasePrice: context.ownedCard.purchasePrice.value }),
        });
        const recommendation = recommendCard({
          definition: context.cardDefinition,
          ownedCard: context.ownedCard,
          profile: context.profile,
          tags: context.tags,
          market,
        });
        if (active) {
          setResult({
            key: loadKey,
            state: {
              kind: 'ready',
              value: {
                context: {
                  ...context,
                  cardDefinition: context.cardDefinition,
                  ownedCard: context.ownedCard,
                },
                latestMarketObservation,
                market,
                recommendation,
              },
            },
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setResult({
            key: loadKey,
            state: {
              kind: 'error',
              reason:
                error instanceof Error
                  ? error.message
                  : 'workspace-load-failed',
            },
          });
        }
      });

    return () => {
      active = false;
    };
  }, [card, loadKey, selectedLocation, selectedOwnershipStatus]);

  const reload = useCallback(() => {
    setReloadVersion((version) => version + 1);
  }, []);

  const state: WorkspaceState =
    card === null
      ? { kind: 'idle' }
      : result?.key === loadKey
        ? result.state
        : { kind: 'loading' };
  return { state, reload };
}

function formatValue(observation: ObservationValue): string {
  if (observation.value === null) return 'Unknown';
  if (typeof observation.value === 'boolean') {
    return observation.value ? 'Yes' : 'No';
  }
  return String(observation.value);
}

function formatCoins(value: number | null): string {
  return value === null ? '—' : `${value.toLocaleString()} coins`;
}

function FactRow({
  label,
  observation,
}: {
  label: string;
  observation: ObservationValue;
}) {
  return (
    <div className="fact-row">
      <span>{label}</span>
      <span className="fact-row__value">
        {formatValue(observation)}
        <small className={`fact-status fact-status--${observation.status}`}>
          {observation.status}
        </small>
      </span>
    </div>
  );
}

function StateNotice({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <article className="observation-card observation-card--notice">
      <p className="card-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{detail}</p>
    </article>
  );
}

function OrderedVisibleCards({
  ariaLabel,
  cards,
  itemLabel,
  selectedIndex = null,
}: {
  ariaLabel: string;
  cards: VisibleCard[];
  itemLabel: string;
  selectedIndex?: number | null;
}) {
  return (
    <ul aria-label={ariaLabel} className="compact-list compact-list--cards">
      {cards.map((card, index) => (
        <li key={`${index}:${card.localObservationId}`}>
          <span className="compact-list__detail">
            <span>
              {itemLabel} {index + 1}
              {selectedIndex === index ? ' · visibly selected' : ''}
            </span>
            <small>{formatValue(card.name)}</small>
          </span>
          <strong>
            {formatValue(card.overall)} · {formatValue(card.position)}
          </strong>
        </li>
      ))}
    </ul>
  );
}

function ReadyObservation({ snapshot }: { snapshot: AdapterSnapshot }) {
  if (snapshot.event.type === 'marketContext.visible') {
    const card = snapshot.event.payload.selectedCard;
    if (card === null) {
      return (
        <StateNotice
          eyebrow="Transfer List recognized"
          title="No transfer item selected"
          detail="The list is supported, but no visible item detail is open."
        />
      );
    }
    const confidence = Math.round(snapshot.event.confidence * 100);
    const transferMarket =
      card.tradeability.evidence?.includes(
        'visible-transfer-market-context',
      ) === true;
    return (
      <article className="observation-card observation-card--ready">
        <div className="selected-card-heading">
          <div>
            <p className="card-eyebrow">
              {transferMarket
                ? 'Transfer Market context'
                : 'Transfer List context'}
            </p>
            <h2>{formatValue(card.name)}</h2>
          </div>
          <div
            aria-label={`Overall ${formatValue(card.overall)}`}
            className="rating-badge"
          >
            {formatValue(card.overall)}
            <span>{formatValue(card.position)}</span>
          </div>
        </div>

        <div className="calculation-grid calculation-grid--compact">
          {snapshot.event.payload.displayedPrices.length === 0 ? (
            <div>
              <span>Displayed coin values</span>
              <strong>None</strong>
            </div>
          ) : (
            snapshot.event.payload.displayedPrices.map((price, index) => (
              <div key={`${index}:${price.value ?? 'unknown'}`}>
                <span>
                  {price.evidence?.includes(
                    'visible-transfer-market-start-price',
                  )
                    ? 'Start price'
                    : price.evidence?.includes(
                          'visible-transfer-market-buy-now-price',
                        )
                      ? 'Buy Now price'
                      : `Displayed coin value ${index + 1}`}
                </span>
                <strong>{formatCoins(price.value)}</strong>
              </div>
            ))
          )}
        </div>

        <div className="facts">
          <FactRow label="Tradeability" observation={card.tradeability} />
          <FactRow label="Rarity family" observation={card.rarity} />
        </div>
        <p className="helper-text">
          Values are read-only context and are not saved as a market price. FUT
          Copilot never activates Watch, Bid, Buy, List, or Re-list.
        </p>
        <footer className="observation-meta">
          <span>{confidence}% extraction confidence</span>
          <span>{snapshot.event.adapterVersion}</span>
        </footer>
      </article>
    );
  }

  if (snapshot.event.type === 'activeSquad.visible') {
    const slots = snapshot.event.payload.slots;
    const groupSummary = (
      [
        ['starting', 'Starting XI'],
        ['bench', 'Substitutes'],
        ['reserves', 'Reserves'],
      ] as const
    ).map(([group, label]) => {
      const groupSlots = slots.filter((slot) => slot.group === group);
      return {
        group,
        label,
        occupied: groupSlots.filter((slot) => slot.card !== null).length,
        total: groupSlots.length,
      };
    });
    const occupied = slots.filter((slot) => slot.card !== null).length;
    const confidence = Math.round(snapshot.event.confidence * 100);

    return (
      <article className="observation-card observation-card--ready">
        <div className="selected-card-heading">
          <div>
            <p className="card-eyebrow">Active squad</p>
            <h2>
              {occupied}/{slots.length} player slots occupied
            </h2>
          </div>
          <span className="identity-pill">live context</span>
        </div>

        <div className="calculation-grid calculation-grid--compact">
          {groupSummary.map((summary) => (
            <div key={summary.group}>
              <span>{summary.label}</span>
              <strong>
                {summary.occupied}/{summary.total}
              </strong>
            </div>
          ))}
        </div>

        <ul
          aria-label="Visible active squad slots"
          className="compact-list compact-list--cards"
        >
          {slots.map((slot) => (
            <li key={slot.slot}>
              <span className="compact-list__detail">
                <span>{slot.slot}</span>
                <small>{slot.group}</small>
              </span>
              <strong>
                {slot.card === null
                  ? 'Empty'
                  : `${formatValue(slot.card.overall)} · ${formatValue(slot.card.position)}`}
              </strong>
            </li>
          ))}
        </ul>

        <p className="helper-text">
          This screen does not expose player names as visible text. FUT Copilot
          keeps them unknown instead of matching by image or hidden data.
        </p>

        <footer className="observation-meta">
          <span>{confidence}% extraction confidence</span>
          <span>{snapshot.event.adapterVersion}</span>
        </footer>
      </article>
    );
  }

  if (snapshot.event.type === 'sbcContext.visible') {
    const confidence = Math.round(snapshot.event.confidence * 100);
    return (
      <article className="observation-card observation-card--ready">
        <div className="selected-card-heading">
          <div>
            <p className="card-eyebrow">SBC context</p>
            <h2>{formatValue(snapshot.event.payload.challengeName)}</h2>
          </div>
          <span className="identity-pill">read only</span>
        </div>

        <div className="facts">
          <FactRow
            label="Distinct segment name"
            observation={snapshot.event.payload.segmentName}
          />
          <div className="fact-row">
            <span>Loaded player cards</span>
            <strong>{snapshot.event.payload.cards.length}</strong>
          </div>
        </div>

        <ul
          aria-label="Visible SBC requirements"
          className="compact-list compact-list--cards"
        >
          {snapshot.event.payload.requirementLabels.map(
            (requirement, index) => (
              <li key={`${index}:${requirement.value ?? 'unknown'}`}>
                <span className="compact-list__detail">
                  <span>Requirement {index + 1}</span>
                </span>
                <strong>{formatValue(requirement)}</strong>
              </li>
            ),
          )}
        </ul>

        <p className="helper-text">
          Requirement labels are visible read-only context. Unsupported
          constraints keep planner proposals blocked, and FUT Copilot never
          fills or submits the squad.
        </p>

        <footer className="observation-meta">
          <span>{confidence}% extraction confidence</span>
          <span>{snapshot.event.adapterVersion}</span>
        </footer>
      </article>
    );
  }

  if (
    snapshot.event.type === 'packResult.visible' ||
    snapshot.event.type === 'cards.visible'
  ) {
    const cards = snapshot.event.payload.cards;
    const packResult = snapshot.event.type === 'packResult.visible';
    const confidence = Math.round(snapshot.event.confidence * 100);
    return (
      <article className="observation-card observation-card--ready">
        <div className="selected-card-heading">
          <div>
            <p className="card-eyebrow">
              {packResult ? 'Pack result' : 'Visible cards'}
            </p>
            <h2>{cards.length} visible cards</h2>
          </div>
          <span className="identity-pill">read only</span>
        </div>
        <OrderedVisibleCards
          ariaLabel={packResult ? 'Ordered pack-result cards' : 'Visible cards'}
          cards={cards}
          itemLabel={packResult ? 'Pack card' : 'Card'}
        />
        <p className="helper-text">
          Visible order is preserved. FUT Copilot cannot open the pack, send an
          item, or advance the result screen.
        </p>
        <footer className="observation-meta">
          <span>{confidence}% extraction confidence</span>
          <span>{snapshot.event.adapterVersion}</span>
        </footer>
      </article>
    );
  }

  if (snapshot.event.type === 'playerPick.visible') {
    const { options, selectedIndex } = snapshot.event.payload;
    const confidence = Math.round(snapshot.event.confidence * 100);
    return (
      <article className="observation-card observation-card--ready">
        <div className="selected-card-heading">
          <div>
            <p className="card-eyebrow">Player pick</p>
            <h2>{options.length} visible options</h2>
          </div>
          <span className="identity-pill">
            {selectedIndex === null
              ? 'no option selected'
              : `option ${selectedIndex + 1} visible`}
          </span>
        </div>
        <OrderedVisibleCards
          ariaLabel="Ordered player-pick options"
          cards={options}
          itemLabel="Option"
          selectedIndex={selectedIndex}
        />
        <p className="helper-text">
          Options are read-only observations. FUT Copilot never selects or
          confirms a player-pick option.
        </p>
        <footer className="observation-meta">
          <span>{confidence}% extraction confidence</span>
          <span>{snapshot.event.adapterVersion}</span>
        </footer>
      </article>
    );
  }

  if (snapshot.event.type === 'duplicate.detected') {
    const { duplicate, existingCard } = snapshot.event.payload;
    const confidence = Math.round(snapshot.event.confidence * 100);
    return (
      <article className="observation-card observation-card--ready">
        <div className="selected-card-heading">
          <div>
            <p className="card-eyebrow">Duplicate detected</p>
            <h2>{formatValue(duplicate.name)}</h2>
          </div>
          <div
            aria-label={`Overall ${formatValue(duplicate.overall)}`}
            className="rating-badge"
          >
            {formatValue(duplicate.overall)}
            <span>{formatValue(duplicate.position)}</span>
          </div>
        </div>
        <div className="facts">
          <FactRow label="Tradeability" observation={duplicate.tradeability} />
          <div className="fact-row">
            <span>Existing copy visible</span>
            <strong>{existingCard === null ? 'No' : 'Yes'}</strong>
          </div>
        </div>
        <p className="helper-text">
          The normalized event creates or updates one local triage case. FUT
          Copilot never sends, lists, submits, discards, or quick-sells either
          item.
        </p>
        <footer className="observation-meta">
          <span>{confidence}% extraction confidence</span>
          <span>{snapshot.event.adapterVersion}</span>
        </footer>
      </article>
    );
  }

  if (
    snapshot.event.type !== 'card.selected' ||
    snapshot.event.payload.card === null
  ) {
    return (
      <StateNotice
        eyebrow="Adapter warning"
        title="Observation mismatch"
        detail="The stored event did not contain a supported visible context. Observe again."
      />
    );
  }

  const card = snapshot.event.payload.card;
  const confidence = Math.round(snapshot.event.confidence * 100);

  return (
    <article className="observation-card observation-card--ready">
      <div className="selected-card-heading">
        <div>
          <p className="card-eyebrow">Selected card</p>
          <h2>{formatValue(card.name)}</h2>
        </div>
        <div
          className="rating-badge"
          aria-label={`Overall ${formatValue(card.overall)}`}
        >
          {formatValue(card.overall)}
          <span>{formatValue(card.position)}</span>
        </div>
      </div>

      <div className="face-stats" aria-label="Visible face statistics">
        {card.faceStats.map((stat) => (
          <div className="face-stat" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>

      <div className="facts">
        <FactRow label="Rarity family" observation={card.rarity} />
        <FactRow label="Tradeability" observation={card.tradeability} />
        <FactRow label="First owner" observation={card.firstOwner} />
        <FactRow label="Loan" observation={card.loan} />
      </div>

      <footer className="observation-meta">
        <span>{confidence}% extraction confidence</span>
        <span>{snapshot.event.adapterVersion}</span>
      </footer>
    </article>
  );
}

function ObservationContent({ state }: { state: PanelState }) {
  if (state.kind === 'loading') {
    return (
      <StateNotice
        eyebrow="Reading visible UI"
        title="Observing visible context…"
        detail="Only normalized visible fields cross the adapter boundary."
      />
    );
  }
  if (state.kind === 'disconnected') {
    return (
      <StateNotice
        eyebrow="Waiting for EA"
        title="No Web App observation yet"
        detail="Open the EA Web App on Active Squad or select a card in My Club Players."
      />
    );
  }
  if (state.kind === 'error') {
    return (
      <StateNotice
        eyebrow="Connection issue"
        title="Could not observe the active tab"
        detail={`Reason: ${state.reason}. Keep the EA Web App active and try again.`}
      />
    );
  }
  if (state.snapshot.state === 'ready') {
    return <ReadyObservation snapshot={state.snapshot} />;
  }
  if (state.snapshot.state === 'empty') {
    return (
      <StateNotice
        eyebrow="Club screen recognized"
        title="Select a player card"
        detail="The Club screen is supported, but no detail carousel is open."
      />
    );
  }

  const reasons = state.snapshot.event.payload.reasonCodes.join(', ');
  return (
    <StateNotice
      eyebrow={
        state.snapshot.state === 'unsupported'
          ? 'Unsupported screen'
          : 'Adapter degraded'
      }
      title="The visible state is not reliable enough"
      detail={`Reason: ${reasons}. No card identity was guessed.`}
    />
  );
}

function RecommendationCard({ value }: { value: CardRecommendationResult }) {
  return (
    <article className="workspace-card recommendation-card">
      <div className="workspace-card__heading">
        <div>
          <p className="card-eyebrow">Recommendation</p>
          <h3>{value.primary.action.replaceAll('-', ' ')}</h3>
        </div>
        <span className="confidence-pill">
          {Math.round(value.primary.confidence * 100)}%
        </span>
      </div>
      <ul className="reason-list">
        {value.primary.reasons.slice(0, 3).map((reason) => (
          <li key={reason.code}>
            <strong>{reason.summary}</strong>
            <span>{reason.detail}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function PersonalizationCard({
  workspace,
  onSaved,
}: {
  workspace: WorkspaceReady;
  onSaved: () => void;
}) {
  const ownedCard = workspace.context.ownedCard;
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    ownedCard.personalTagIds,
  );
  const [notes, setNotes] = useState(ownedCard.notes);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  );

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
    setSaveState('idle');
  };

  const save = () => {
    setSaveState('saving');
    void updateOwnedCardPersonalization(database, {
      ownedCardId: ownedCard.id,
      personalTagIds: selectedTagIds,
      notes,
    }).then(() => {
      setSaveState('saved');
      onSaved();
    });
  };

  const identity = workspace.context.identity;
  const identityConfidence =
    identity.status === 'ambiguous' ? 0 : identity.confidence;
  const research = createFutggResearchLink({
    playerName: workspace.context.cardDefinition.name.value ?? 'player',
    identityConfidence,
  });

  return (
    <article className="workspace-card">
      <div className="workspace-card__heading">
        <div>
          <p className="card-eyebrow">My card</p>
          <h3>Personal context</h3>
        </div>
        <span className="identity-pill">
          {identity.status} · {Math.round(identityConfidence * 100)}%
        </span>
      </div>

      <div className="tag-grid" aria-label="Personal tags">
        {workspace.context.tags.map((tag) => {
          const selected = selectedTagIds.includes(tag.id);
          return (
            <button
              aria-pressed={selected}
              className={`tag-button${selected ? ' tag-button--selected' : ''}`}
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              style={{ '--tag-color': tag.color } as React.CSSProperties}
              type="button"
            >
              {tag.name}
            </button>
          );
        })}
      </div>

      <label className="field">
        <span>Personal notes</span>
        <textarea
          maxLength={4_000}
          onChange={(event) => {
            setNotes(event.target.value);
            setSaveState('idle');
          }}
          placeholder="Why you keep it, Evo plans, squad role…"
          rows={3}
          value={notes}
        />
      </label>

      <div className="button-row">
        <button
          className="secondary-button"
          disabled={saveState === 'saving'}
          onClick={save}
          type="button"
        >
          {saveState === 'saving'
            ? 'Saving…'
            : saveState === 'saved'
              ? 'Saved locally'
              : 'Save context'}
        </button>
        <a href={research.url} rel="noreferrer" target="_blank">
          {research.mode === 'exact' ? 'Exact FUT.GG' : 'Search FUT.GG'}
        </a>
      </div>
      <p className="helper-text">
        FUT.GG opens only after your click. No prices are fetched or scraped.
      </p>
    </article>
  );
}

function WorkspaceContent({
  state,
  onSaved,
}: {
  state: WorkspaceState;
  onSaved: () => void;
}) {
  if (state.kind === 'idle') return null;
  if (state.kind === 'loading') {
    return (
      <StateNotice
        eyebrow="Local workspace"
        title="Matching your card…"
        detail="Resolving a safe local identity and loading personal context."
      />
    );
  }
  if (state.kind === 'error') {
    return (
      <StateNotice
        eyebrow="Local storage issue"
        title="Personal context is unavailable"
        detail={state.reason}
      />
    );
  }
  if (state.kind === 'ambiguous') {
    const count =
      state.context.identity.status === 'ambiguous'
        ? state.context.identity.candidates.length
        : 0;
    return (
      <StateNotice
        eyebrow="Identity confirmation needed"
        title={`${count} local card matches`}
        detail="No tags or notes were attached because the identity could not be resolved safely."
      />
    );
  }

  return (
    <div className="workspace-stack">
      <PersonalizationCard
        key={`${state.value.context.ownedCard.id}:${state.value.context.ownedCard.personalTagIds.join(',')}:${state.value.context.ownedCard.notes}`}
        workspace={state.value}
        onSaved={onSaved}
      />
      <RecommendationCard value={state.value.recommendation} />
    </div>
  );
}

function MarketWorkspace({
  workspace,
  onSaved,
}: {
  workspace: WorkspaceReady;
  onSaved: () => void;
}) {
  const latest = workspace.latestMarketObservation;
  const purchase = workspace.context.ownedCard.purchasePrice?.value;
  const [observedPrice, setObservedPrice] = useState(
    latest === null ? '' : String(latest.amount),
  );
  const [purchasePrice, setPurchasePrice] = useState(
    purchase === null || purchase === undefined ? '' : String(purchase),
  );
  const [targetSalePrice, setTargetSalePrice] = useState('');
  const [taxPercent, setTaxPercent] = useState('5');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  );
  const observed = observedPrice === '' ? undefined : Number(observedPrice);
  const purchased = purchasePrice === '' ? undefined : Number(purchasePrice);
  const target = targetSalePrice === '' ? undefined : Number(targetSalePrice);
  const taxRate = Number(taxPercent) / 100;
  const calculation: MarketCalculation | null = (() => {
    try {
      return calculateMarket({
        ...(observed === undefined ? {} : { observedPrice: observed }),
        ...(purchased === undefined ? {} : { purchasePrice: purchased }),
        ...(target === undefined ? {} : { targetSalePrice: target }),
        taxRate,
        ...(latest === null ? {} : { observedAt: latest.observedAt }),
      });
    } catch {
      return null;
    }
  })();

  const save = () => {
    if (
      observed === undefined ||
      !Number.isInteger(observed) ||
      observed <= 0
    ) {
      return;
    }
    setSaveState('saving');
    const { context } = workspace;
    void Promise.all([
      recordManualMarketObservation(database, {
        profileId: context.profile.id,
        cardDefinitionId: context.cardDefinition.id,
        amount: observed,
        platform: context.profile.platform,
      }),
      updateOwnedCardPurchasePrice(database, {
        ownedCardId: context.ownedCard.id,
        amount:
          purchased === undefined || !Number.isInteger(purchased)
            ? null
            : purchased,
      }),
    ]).then(() => {
      setSaveState('saved');
      onSaved();
    });
  };

  return (
    <div className="workspace-stack">
      <article className="workspace-card">
        <div className="workspace-card__heading">
          <div>
            <p className="card-eyebrow">
              {workspace.context.profile.platform} market
            </p>
            <h3>Manual calculator</h3>
          </div>
          <span className="identity-pill">
            {calculation?.observationStatus ?? 'invalid'}
          </span>
        </div>

        <div className="field-grid">
          <label className="field">
            <span>Observed buy-now</span>
            <input
              inputMode="numeric"
              min="1"
              onChange={(event) => {
                setObservedPrice(event.target.value);
                setSaveState('idle');
              }}
              placeholder="42,000"
              type="number"
              value={observedPrice}
            />
          </label>
          <label className="field">
            <span>Your purchase price</span>
            <input
              inputMode="numeric"
              min="0"
              onChange={(event) => {
                setPurchasePrice(event.target.value);
                setSaveState('idle');
              }}
              placeholder="35,000"
              type="number"
              value={purchasePrice}
            />
          </label>
          <label className="field">
            <span>Target sale</span>
            <input
              inputMode="numeric"
              min="1"
              onChange={(event) => setTargetSalePrice(event.target.value)}
              placeholder="Optional"
              type="number"
              value={targetSalePrice}
            />
          </label>
          <label className="field">
            <span>Tax percent</span>
            <input
              max="25"
              min="0"
              onChange={(event) => setTaxPercent(event.target.value)}
              step="0.1"
              type="number"
              value={taxPercent}
            />
          </label>
        </div>

        <div className="calculation-grid">
          <div>
            <span>Expected net</span>
            <strong>
              {formatCoins(calculation?.expectedNetProceeds ?? null)}
            </strong>
          </div>
          <div>
            <span>Break-even list</span>
            <strong>
              {formatCoins(calculation?.breakEvenListPrice ?? null)}
            </strong>
          </div>
          <div>
            <span>Estimated P/L</span>
            <strong>
              {formatCoins(calculation?.estimatedProfitLoss ?? null)}
            </strong>
          </div>
          <div>
            <span>Observation age</span>
            <strong>
              {calculation?.observationAgeHours === null ||
              calculation?.observationAgeHours === undefined
                ? '—'
                : `${calculation.observationAgeHours.toFixed(1)}h`}
            </strong>
          </div>
        </div>

        <button
          className="secondary-button"
          disabled={calculation === null || observed === undefined}
          onClick={save}
          type="button"
        >
          {saveState === 'saving'
            ? 'Saving…'
            : saveState === 'saved'
              ? 'Saved locally'
              : 'Save market observation'}
        </button>
      </article>

      <MarketJournalWorkspace workspace={workspace} />
      <RecommendationCard value={workspace.recommendation} />
    </div>
  );
}

function MarketJournalWorkspace({ workspace }: { workspace: WorkspaceReady }) {
  const [entries, setEntries] = useState<MarketTransaction[] | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [transactionType, setTransactionType] =
    useState<MarketTransaction['transactionType']>('target-created');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  );
  const cardDefinitionId = workspace.context.cardDefinition.id;

  useEffect(() => {
    let active = true;
    void getMarketTransactions(database, cardDefinitionId).then((value) => {
      if (active) setEntries(value);
    });
    return () => {
      active = false;
    };
  }, [cardDefinitionId, reloadVersion]);

  const numericAmount = amount === '' ? null : Number(amount);
  const guard =
    transactionType === 'listed' &&
    numericAmount !== null &&
    Number.isInteger(numericAmount)
      ? evaluateSellingGuard({
          ownedCard: workspace.context.ownedCard,
          tags: workspace.context.tags,
          proposedListPrice: numericAmount,
          ...(workspace.market.breakEvenListPrice === null
            ? {}
            : { personalMinimum: workspace.market.breakEvenListPrice }),
        })
      : { warnings: [] };
  const summary = summarizeMarketJournal(entries ?? []);

  const save = () => {
    if (
      numericAmount === null ||
      !Number.isInteger(numericAmount) ||
      numericAmount < 0
    ) {
      return;
    }
    setSaveState('saving');
    void recordMarketTransaction(database, {
      profileId: workspace.context.profile.id,
      cardDefinitionId,
      ownedCardId: workspace.context.ownedCard.id,
      transactionType,
      amount: numericAmount,
      platform: workspace.context.profile.platform,
      userConfirmed: true,
      notes,
    }).then(() => {
      setSaveState('saved');
      setReloadVersion((version) => version + 1);
    });
  };

  return (
    <article className="workspace-card">
      <div className="workspace-card__heading">
        <div>
          <p className="card-eyebrow">Manual lifecycle</p>
          <h3>Transaction journal</h3>
        </div>
        <span className="identity-pill">user confirmed</span>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Event</span>
          <select
            onChange={(event) => {
              setTransactionType(
                event.target.value as MarketTransaction['transactionType'],
              );
              setSaveState('idle');
            }}
            value={transactionType}
          >
            <option value="target-created">Target created</option>
            <option value="purchased">Purchased</option>
            <option value="listed">Listed</option>
            <option value="sold">Sold</option>
            <option value="expired">Expired</option>
            <option value="abandoned">Abandoned</option>
          </select>
        </label>
        <label className="field">
          <span>Coin amount</span>
          <input
            min="0"
            onChange={(event) => {
              setAmount(event.target.value);
              setSaveState('idle');
            }}
            type="number"
            value={amount}
          />
        </label>
      </div>
      <label className="field">
        <span>Journal note</span>
        <input
          maxLength={2_000}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional manual confirmation detail"
          value={notes}
        />
      </label>

      {guard.warnings.length > 0 ? (
        <div className="warning-stack" role="alert">
          {guard.warnings.map((warning) => (
            <p key={warning.code}>{warning.message}</p>
          ))}
        </div>
      ) : null}

      <div className="calculation-grid calculation-grid--compact">
        <div>
          <span>Estimated P/L</span>
          <strong>{formatCoins(summary.estimatedProfitLoss)}</strong>
        </div>
        <div>
          <span>Realized P/L</span>
          <strong>{formatCoins(summary.realizedProfitLoss)}</strong>
        </div>
      </div>

      <button
        className="secondary-button"
        disabled={numericAmount === null}
        onClick={save}
        type="button"
      >
        {saveState === 'saving'
          ? 'Saving…'
          : saveState === 'saved'
            ? 'Logged locally'
            : 'Confirm and log event'}
      </button>

      <ul className="compact-list">
        {(entries ?? []).slice(0, 5).map((entry) => (
          <li key={entry.id}>
            <span>{entry.transactionType.replaceAll('-', ' ')}</span>
            <strong>{entry.amount.toLocaleString()}</strong>
          </li>
        ))}
      </ul>
    </article>
  );
}

function DuplicatesWorkspace({
  observationVersion,
}: {
  observationVersion: string;
}) {
  const [rows, setRows] = useState<DuplicateQueueRow[] | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [selectedActions, setSelectedActions] = useState<
    Record<string, NonNullable<DuplicateCase['resolution']>['action']>
  >({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    void getDuplicateQueueRows(database).then((value) => {
      if (active) setRows(value);
    });
    return () => {
      active = false;
    };
  }, [observationVersion, reloadVersion]);

  const updateState = (
    duplicateCaseId: string,
    state: 'investigating' | 'destination-selected' | 'dismissed',
  ) => {
    void updateDuplicateCaseState(database, {
      duplicateCaseId,
      state,
    }).then(() => setReloadVersion((version) => version + 1));
  };

  const selectDestination = (
    duplicateCaseId: string,
    action: NonNullable<DuplicateCase['resolution']>['action'],
  ) => {
    setSelectedActions((current) => ({
      ...current,
      [duplicateCaseId]: action,
    }));
    updateState(duplicateCaseId, 'destination-selected');
  };

  const confirmResolution = (row: DuplicateQueueRow) => {
    const duplicateCaseId = row.duplicateCase.id;
    const action = selectedActions[duplicateCaseId] ?? 'deferred';
    const resolvedOwnedCardId =
      action === 'kept-existing'
        ? row.duplicateCase.existingOwnedCardId
        : action === 'kept-duplicate'
          ? row.duplicateCase.duplicateOwnedCardId
          : undefined;
    void resolveDuplicateCase(database, {
      duplicateCaseId,
      action,
      ...(resolvedOwnedCardId === undefined ? {} : { resolvedOwnedCardId }),
      notes:
        notes[duplicateCaseId] ??
        `User confirmed the local ${action.replaceAll('-', ' ')} record.`,
    }).then(() => setReloadVersion((version) => version + 1));
  };

  if (rows === null) {
    return (
      <StateNotice
        eyebrow="Duplicate queue"
        title="Loading local cases…"
        detail="Duplicate records never trigger an EA action."
      />
    );
  }
  const activeRows = rows.filter(
    (row) =>
      row.duplicateCase.state !== 'resolved' &&
      row.duplicateCase.state !== 'dismissed',
  );
  if (activeRows.length === 0) {
    return (
      <StateNotice
        eyebrow="Duplicate queue"
        title="No unresolved duplicates"
        detail="Visible duplicate events will create one idempotent local case here. Quick-sell is never the default."
      />
    );
  }

  return (
    <div className="workspace-stack">
      {activeRows.map((row) => (
        <article className="workspace-card" key={row.duplicateCase.id}>
          <div className="workspace-card__heading">
            <div>
              <p className="card-eyebrow">Duplicate detected</p>
              <h3>{row.cardName}</h3>
            </div>
            <span className="identity-pill">{row.duplicateCase.state}</span>
          </div>
          <div className="facts">
            <div className="fact-row">
              <span>Tradeability</span>
              <strong>{row.duplicateCase.tradeability}</strong>
            </div>
            <div className="fact-row">
              <span>Identity</span>
              <strong>{row.identityProvenance.replaceAll('-', ' ')}</strong>
            </div>
            <div className="fact-row">
              <span>Detected</span>
              <strong>
                {new Date(row.duplicateCase.detectedAt).toLocaleDateString()}
              </strong>
            </div>
          </div>
          {row.protected ? (
            <div className="warning-stack" role="alert">
              <p>
                Protected by your local rules
                {row.protectingTagNames.length > 0
                  ? `: ${row.protectingTagNames.join(', ')}`
                  : '.'}
              </p>
            </div>
          ) : null}
          <label className="field">
            <span>Intended result · logged only after your confirmation</span>
            <select
              onChange={(event) =>
                selectDestination(
                  row.duplicateCase.id,
                  event.target.value as NonNullable<
                    DuplicateCase['resolution']
                  >['action'],
                )
              }
              value={selectedActions[row.duplicateCase.id] ?? 'deferred'}
            >
              <option value="deferred">Defer safely</option>
              <option value="kept-existing">Kept existing copy</option>
              <option value="kept-duplicate">Kept duplicate copy</option>
              <option value="listed">Listed manually</option>
              <option value="used-in-sbc">Used in SBC manually</option>
              <option value="quick-sold">Quick-sold manually</option>
            </select>
          </label>
          <label className="field">
            <span>Resolution note</span>
            <input
              maxLength={2_000}
              onChange={(event) =>
                setNotes((current) => ({
                  ...current,
                  [row.duplicateCase.id]: event.target.value,
                }))
              }
              placeholder="Optional manual action detail"
              value={notes[row.duplicateCase.id] ?? ''}
            />
          </label>
          {selectedActions[row.duplicateCase.id] === 'quick-sold' ? (
            <p className="helper-text">
              This records an action you already performed. FUT Copilot cannot
              quick-sell the item.
            </p>
          ) : null}
          <div className="button-row button-row--wrap">
            <button
              className="secondary-button"
              onClick={() => updateState(row.duplicateCase.id, 'investigating')}
              type="button"
            >
              Investigate
            </button>
            <button
              className="secondary-button"
              onClick={() => confirmResolution(row)}
              type="button"
            >
              Confirm and resolve locally
            </button>
            <button
              className="text-button"
              onClick={() => updateState(row.duplicateCase.id, 'dismissed')}
              type="button"
            >
              Dismiss
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function SbcWorkspace({ snapshot }: { snapshot: AdapterSnapshot | null }) {
  const visibleEvent =
    snapshot?.state === 'ready' && snapshot.event.type === 'sbcContext.visible'
      ? snapshot.event
      : null;
  const visibleLabels =
    visibleEvent?.payload.requirementLabels.flatMap((label) =>
      label.value === null ? [] : [label.value],
    ) ?? [];
  const visibleRequirements = parseRatingOnlyRequirements(visibleLabels);
  const [requiredPlayers, setRequiredPlayers] = useState(
    String(visibleRequirements.requiredPlayers ?? 11),
  );
  const [requiredRating, setRequiredRating] = useState(
    String(visibleRequirements.requiredRating ?? 84),
  );
  const [strategy, setStrategy] =
    useState<SbcPlannerStrategy>('duplicate-cleanup');
  const [inventory, setInventory] = useState<SbcPlannerCard[] | null>(null);
  const [visibleProtection, setVisibleProtection] = useState<
    VisibleCardProtectionResult[] | null
  >(visibleEvent === null ? [] : null);
  const [savedProposal, setSavedProposal] = useState<SbcProposal | null>(null);

  useEffect(() => {
    let active = true;
    void getSbcInventory(database).then((value) => {
      if (active) setInventory(value);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (visibleEvent === null) {
      return () => {
        active = false;
      };
    }
    void scanVisibleCardProtection(database, visibleEvent.payload.cards).then(
      (value) => {
        if (active) setVisibleProtection(value);
      },
    );
    return () => {
      active = false;
    };
  }, [visibleEvent]);

  const playerCount = Number(requiredPlayers);
  const ratingTarget = Number(requiredRating);
  const plan =
    inventory === null ||
    !Number.isInteger(playerCount) ||
    !Number.isInteger(ratingTarget)
      ? null
      : planRatingOnlySbc({
          cards: inventory,
          requiredPlayers: playerCount,
          requiredRating: ratingTarget,
          strategy,
        });
  const proposalIsValid =
    plan?.valid === true &&
    visibleRequirements.unsupportedLabels.length === 0 &&
    visibleProtection !== null &&
    visibleProtection.every((result) => result.status === 'clear');

  const saveProposal = () => {
    if (plan === null || !proposalIsValid) return;
    const timestamp = new Date().toISOString();
    const sbcDefinition = sbcDefinitionSchema.parse({
      id: crypto.randomUUID(),
      fcYear: 26,
      name: visibleEvent?.payload.challengeName.value ?? 'Manual rating SBC',
      segmentName:
        visibleEvent?.payload.segmentName.value ??
        `${ratingTarget}-Rated Squad`,
      requirements: [
        {
          id: crypto.randomUUID(),
          label: `Players: ${playerCount}`,
          kind: 'minimum-count',
          threshold: playerCount,
          qualifier: 'players',
          status: 'known',
        },
        {
          id: crypto.randomUUID(),
          label: `Team Overall Rating: Min. ${ratingTarget}`,
          kind: 'minimum-rating',
          threshold: ratingTarget,
          status: 'known',
        },
      ],
      observedAt: timestamp,
    });
    const proposal = createSbcProposal({
      profileId: inventory?.[0]?.ownedCard.profileId ?? DEFAULT_PROFILE_ID,
      sbcDefinitionId: sbcDefinition.id,
      requiredPlayers: playerCount,
      requiredRating: ratingTarget,
      strategy,
      plan,
    });
    void saveSbcProposal(database, sbcDefinition, proposal).then(() =>
      setSavedProposal(proposal),
    );
  };

  return (
    <div className="workspace-stack">
      <article className="workspace-card">
        <div className="workspace-card__heading">
          <div>
            <p className="card-eyebrow">Rating-only assistant</p>
            <h3>SBC proposal</h3>
          </div>
          <span className="identity-pill">
            {visibleEvent === null ? 'manual target' : 'visible target'}
          </span>
        </div>
        <div className="field-grid">
          <label className="field">
            <span>Players required</span>
            <input
              max="23"
              min="1"
              onChange={(event) => setRequiredPlayers(event.target.value)}
              type="number"
              value={requiredPlayers}
            />
          </label>
          <label className="field">
            <span>Minimum rating</span>
            <input
              max="99"
              min="1"
              onChange={(event) => setRequiredRating(event.target.value)}
              type="number"
              value={requiredRating}
            />
          </label>
        </div>
        <label className="field">
          <span>Strategy</span>
          <select
            onChange={(event) =>
              setStrategy(event.target.value as SbcPlannerStrategy)
            }
            value={strategy}
          >
            <option value="duplicate-cleanup">Duplicate cleanup</option>
            <option value="club-preservation">Club preservation</option>
            <option value="low-coin-cost">Low coin-equivalent cost</option>
          </select>
        </label>

        {visibleRequirements.unsupportedLabels.length > 0 ? (
          <div className="warning-stack" role="alert">
            <p>
              Unsupported requirement:{' '}
              {visibleRequirements.unsupportedLabels.join(', ')}
            </p>
          </div>
        ) : null}

        {visibleProtection === null ? (
          <p className="helper-text">Scanning visible SBC cards…</p>
        ) : null}
        {(visibleProtection ?? [])
          .filter((result) => result.status !== 'clear')
          .map((result) => (
            <div
              className="warning-stack"
              key={result.localObservationId}
              role="alert"
            >
              <p>
                {result.cardName}:{' '}
                {result.status === 'protected'
                  ? 'protected locally'
                  : 'identity unresolved'}
                . {result.reason}
              </p>
              {result.protectingTagNames.length > 0 ? (
                <p>Protecting tags: {result.protectingTagNames.join(', ')}</p>
              ) : null}
            </div>
          ))}

        <div className="calculation-grid calculation-grid--compact">
          <div>
            <span>Known inventory</span>
            <strong>{inventory?.length ?? 0} cards</strong>
          </div>
          <div>
            <span>Proposal rating</span>
            <strong>{plan?.estimatedRating ?? '—'}</strong>
          </div>
          <div>
            <span>Rating overshoot</span>
            <strong>{plan?.overshoot ?? '—'}</strong>
          </div>
          <div>
            <span>Protected excluded</span>
            <strong>{plan?.excludedProtectedCardIds.length ?? 0}</strong>
          </div>
          <div>
            <span>Validation</span>
            <strong>{proposalIsValid ? 'valid locally' : 'not valid'}</strong>
          </div>
        </div>

        <ul className="compact-list compact-list--cards">
          {(plan?.selected ?? []).map((card) => (
            <li key={card.ownedCard.id}>
              <span className="compact-list__detail">
                <span>
                  {card.definition.name.value ?? 'Unknown'}
                  {card.duplicate ? ' · duplicate' : ''}
                </span>
                <small>
                  {plan?.selectionReasons.find(
                    (reason) => reason.ownedCardId === card.ownedCard.id,
                  )?.reason ?? 'Strategy rating fit'}
                  {' · '}
                  {Math.round(
                    (plan?.selectionReasons.find(
                      (reason) => reason.ownedCardId === card.ownedCard.id,
                    )?.confidence ?? 0) * 100,
                  )}
                  % confidence
                </small>
              </span>
              <strong>{card.definition.overall.value ?? '—'}</strong>
            </li>
          ))}
        </ul>

        {(plan?.warnings ?? []).map((warning) => (
          <p className="helper-text" key={warning}>
            {warning}
          </p>
        ))}
        <button
          className="secondary-button"
          disabled={!proposalIsValid}
          onClick={saveProposal}
          type="button"
        >
          {savedProposal === null
            ? 'Save reviewable proposal'
            : 'Proposal saved locally'}
        </button>
        <p className="helper-text">
          This planner cannot place cards or submit an SBC in EA.
        </p>
      </article>
    </div>
  );
}

function downloadJson(filename: string, value: unknown): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function SettingsWorkspace({ snapshot }: { snapshot: AdapterSnapshot | null }) {
  const [profileState, setProfileState] = useState<
    | { kind: 'loading' }
    | {
        kind: 'ready';
        profile: Awaited<ReturnType<typeof ensureDefaultProfile>>['profile'];
        counts: Record<string, number>;
        diagnostics: AdapterDiagnostics;
      }
  >({ kind: 'loading' });
  const [reloadVersion, setReloadVersion] = useState(0);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [importStatus, setImportStatus] = useState('');
  const snapshotUpdatedAt = snapshot?.updatedAt ?? 'none';

  useEffect(() => {
    let active = true;
    void ensureDefaultProfile(database).then(async ({ profile }) => {
      const [counts, diagnostics] = await Promise.all([
        getTableCounts(database),
        getAdapterDiagnostics(database),
      ]);
      if (active) {
        setProfileState({ kind: 'ready', profile, counts, diagnostics });
      }
    });
    return () => {
      active = false;
    };
  }, [reloadVersion, snapshotUpdatedAt]);

  if (profileState.kind === 'loading') {
    return (
      <StateNotice
        eyebrow="Local settings"
        title="Loading workspace…"
        detail="All settings and backups remain on this device."
      />
    );
  }

  const { profile, counts, diagnostics } = profileState;
  const adapterStatus =
    snapshot === null
      ? 'No observation'
      : snapshot.state === 'ready' || snapshot.state === 'empty'
        ? 'Healthy'
        : snapshot.state;

  const exportBackup = () => {
    void exportDatabase(database).then((backup) =>
      downloadJson(`fut-copilot-backup-${Date.now()}.json`, backup),
    );
  };

  const readImport = (file: File | undefined) => {
    if (file === undefined) return;
    void file
      .text()
      .then((text) => previewImport(JSON.parse(text) as unknown))
      .then((preview) => {
        setImportPreview(preview);
        setImportStatus(`${preview.summary.totalRecords} records ready`);
      })
      .catch(() => {
        setImportPreview(null);
        setImportStatus('Invalid or unsupported backup');
      });
  };

  const runImport = (mode: 'merge' | 'replace') => {
    if (importPreview === null) return;
    void importDatabase(database, importPreview.backup, {
      mode,
      createBackupBeforeReplace: mode === 'replace',
    }).then((result) => {
      if (result.priorBackup !== undefined) {
        downloadJson(
          `fut-copilot-before-replace-${Date.now()}.json`,
          result.priorBackup,
        );
      }
      setImportStatus(`${result.totalRecords} records imported (${mode})`);
      setReloadVersion((version) => version + 1);
    });
  };

  return (
    <div className="workspace-stack">
      <ProfileSettingsForm
        key={profile.updatedAt}
        profile={profile}
        onSaved={() => setReloadVersion((version) => version + 1)}
      />

      <article className="workspace-card">
        <div className="workspace-card__heading">
          <div>
            <p className="card-eyebrow">Adapter compatibility</p>
            <h3>{adapterStatus}</h3>
          </div>
          <span className="identity-pill">{ADAPTER_VERSION}</span>
        </div>
        <div className="facts">
          <div className="fact-row">
            <span>FC year</span>
            <strong>26</strong>
          </div>
          <div className="fact-row">
            <span>Web App build</span>
            <strong>{diagnostics.lastKnownWebAppBuild ?? 'Not exposed'}</strong>
          </div>
          <div className="fact-row">
            <span>Live-supported screens</span>
            <strong>
              English Club card, squad, Transfer List, market + empty SBC
            </strong>
          </div>
          <div className="fact-row">
            <span>Synthetic-only contexts</span>
            <strong>3 workflow contexts</strong>
          </div>
          <div className="fact-row">
            <span>Last successful observation</span>
            <strong>
              {diagnostics.lastSuccessfulAt === null
                ? 'Never'
                : new Date(diagnostics.lastSuccessfulAt).toLocaleString()}
            </strong>
          </div>
          <div className="fact-row">
            <span>Last successful event</span>
            <strong>{diagnostics.lastSuccessfulEventType ?? 'None'}</strong>
          </div>
          <div className="fact-row">
            <span>Extension version</span>
            <strong>0.1.0</strong>
          </div>
          <div className="fact-row">
            <span>Local records</span>
            <strong>
              {Object.values(counts).reduce((total, count) => total + count, 0)}
            </strong>
          </div>
        </div>
      </article>

      <article className="workspace-card">
        <div className="workspace-card__heading">
          <div>
            <p className="card-eyebrow">Data portability</p>
            <h3>Backup and restore</h3>
          </div>
          <span className="identity-pill">schema v2</span>
        </div>
        <button
          className="secondary-button"
          onClick={exportBackup}
          type="button"
        >
          Export local JSON backup
        </button>
        <label className="field">
          <span>Choose a FUT Copilot backup</span>
          <input
            accept="application/json,.json"
            onChange={(event) => readImport(event.target.files?.[0])}
            type="file"
          />
        </label>
        <p className="helper-text">{importStatus || 'No backup selected.'}</p>
        <div className="button-row">
          <button
            className="secondary-button"
            disabled={importPreview === null}
            onClick={() => runImport('merge')}
            type="button"
          >
            Merge
          </button>
          <button
            className="secondary-button"
            disabled={importPreview === null}
            onClick={() => runImport('replace')}
            type="button"
          >
            Replace + backup
          </button>
        </div>
      </article>
    </div>
  );
}

function ProfileSettingsForm({
  profile,
  onSaved,
}: {
  profile: Awaited<ReturnType<typeof ensureDefaultProfile>>['profile'];
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [platform, setPlatform] = useState(profile.platform);
  const [favoritePlayers, setFavoritePlayers] = useState(
    profile.favoritePlayerNames.join(', '),
  );
  const [favoriteClubs, setFavoriteClubs] = useState(
    profile.favoriteClubNames.join(', '),
  );
  const [recommendationWeights, setRecommendationWeights] = useState(
    profile.recommendationWeights,
  );

  const save = () => {
    const updated = personalProfileSchema.parse({
      ...profile,
      displayName,
      platform,
      favoritePlayerNames: favoritePlayers
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      favoriteClubNames: favoriteClubs
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      recommendationWeights,
      updatedAt: new Date().toISOString(),
    });
    void savePersonalProfile(database, updated).then(onSaved);
  };

  return (
    <article className="workspace-card">
      <div className="workspace-card__heading">
        <div>
          <p className="card-eyebrow">Personal profile</p>
          <h3>{profile.displayName}</h3>
        </div>
        <span className="identity-pill">local only</span>
      </div>
      <label className="field">
        <span>Workspace name</span>
        <input
          maxLength={80}
          onChange={(event) => setDisplayName(event.target.value)}
          value={displayName}
        />
      </label>
      <label className="field">
        <span>Market platform</span>
        <select
          onChange={(event) =>
            setPlatform(event.target.value as typeof profile.platform)
          }
          value={platform}
        >
          <option value="playstation">PlayStation</option>
          <option value="xbox">Xbox</option>
          <option value="pc">PC</option>
          <option value="unknown">Unknown</option>
        </select>
      </label>
      <label className="field">
        <span>Favorite players · comma separated</span>
        <input
          onChange={(event) => setFavoritePlayers(event.target.value)}
          value={favoritePlayers}
        />
      </label>
      <label className="field">
        <span>Favorite clubs · comma separated</span>
        <input
          onChange={(event) => setFavoriteClubs(event.target.value)}
          value={favoriteClubs}
        />
      </label>
      <div className="field">
        <span>Recommendation weights · 0 ignores, 1 maximizes</span>
        <div className="field-grid">
          {(
            [
              ['metaPerformance', 'Meta performance'],
              ['favoritePlayer', 'Favorite player'],
              ['favoriteClub', 'Favorite club'],
              ['evolutionPotential', 'Evolution potential'],
              ['marketValue', 'Market value'],
              ['sbcUtility', 'SBC utility'],
            ] as const
          ).map(([key, label]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <input
                max="1"
                min="0"
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) {
                    setRecommendationWeights((current) => ({
                      ...current,
                      [key]: Math.max(0, Math.min(1, value)),
                    }));
                  }
                }}
                step="0.05"
                type="number"
                value={recommendationWeights[key]}
              />
            </label>
          ))}
        </div>
      </div>
      <button className="secondary-button" onClick={save} type="button">
        Save profile
      </button>
    </article>
  );
}

export function App() {
  const { state, observeVisibleContext } = useAdapterPanelState();
  const snapshot = state.kind === 'snapshot' ? state.snapshot : null;
  const workspace = useCardWorkspace(snapshot);
  const [activeView, setActiveView] = useState<
    'context' | 'duplicates' | 'sbc' | 'market' | 'settings'
  >('context');

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Personal FUT workspace</p>
        <h1>FUT Copilot</h1>
        <p className="hero__summary">
          Understand the visible FUT context, keep your rules local, and make
          every game action yourself.
        </p>
      </header>

      <nav className="view-tabs" aria-label="FUT Copilot workspaces">
        {(['context', 'duplicates', 'sbc', 'market', 'settings'] as const).map(
          (view) => (
            <button
              aria-current={activeView === view ? 'page' : undefined}
              className={
                activeView === view ? 'view-tab view-tab--active' : 'view-tab'
              }
              key={view}
              onClick={() => setActiveView(view)}
              type="button"
            >
              {view}
            </button>
          ),
        )}
      </nav>

      <section className="context" aria-labelledby="context-title">
        <div className="section-heading">
          <h2 id="context-title">
            {activeView === 'context'
              ? 'Selected context'
              : activeView === 'duplicates'
                ? 'Duplicate triage'
                : activeView === 'sbc'
                  ? 'SBC planner'
                  : activeView === 'market'
                    ? 'Market workspace'
                    : 'Settings and health'}
          </h2>
          <span>FC 26 · PlayStation</span>
        </div>

        {activeView === 'context' ? (
          <>
            <ObservationContent state={state} />
            <WorkspaceContent
              state={workspace.state}
              onSaved={workspace.reload}
            />
          </>
        ) : activeView === 'duplicates' ? (
          <DuplicatesWorkspace
            observationVersion={snapshot?.updatedAt ?? 'none'}
          />
        ) : activeView === 'sbc' ? (
          <SbcWorkspace
            key={snapshot?.event.eventId ?? 'manual'}
            snapshot={snapshot}
          />
        ) : activeView === 'settings' ? (
          <SettingsWorkspace snapshot={snapshot} />
        ) : workspace.state.kind === 'ready' ? (
          <MarketWorkspace
            key={`${workspace.state.value.context.ownedCard.id}:${workspace.state.value.latestMarketObservation?.observedAt ?? 'none'}:${workspace.state.value.context.ownedCard.purchasePrice?.observedAt ?? 'none'}`}
            workspace={workspace.state.value}
            onSaved={workspace.reload}
          />
        ) : (
          <StateNotice
            eyebrow="Market workspace"
            title="Observe a selected card first"
            detail="Market observations always attach to a resolved local card identity."
          />
        )}

        <button
          className="observe-button"
          onClick={observeVisibleContext}
          type="button"
        >
          Observe visible context
        </button>
      </section>

      <aside className="boundary" aria-label="Account safety boundary">
        <strong>You stay in control.</strong>
        <span>No automatic buy, list, submit, discard, or quick-sell.</span>
      </aside>
    </main>
  );
}
