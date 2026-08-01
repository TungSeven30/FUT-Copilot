import {
  adapterAcknowledgeResponseSchema,
  adapterSnapshotChangedMessageSchema,
  adapterSnapshotResponseSchema,
  type AdapterSnapshot,
} from '@fut-copilot/domain/messages';
import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

type PanelState =
  | { kind: 'loading' }
  | { kind: 'disconnected' }
  | { kind: 'snapshot'; snapshot: AdapterSnapshot }
  | { kind: 'error'; reason: string };

type ObservationValue = {
  status: 'known' | 'inferred' | 'unknown' | 'stale';
  value: boolean | number | string | null;
};

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
        if (!active) {
          return;
        }

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

  const observeSelectedCard = useCallback(() => {
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

  return { state, observeSelectedCard };
}

function formatValue(observation: ObservationValue): string {
  if (observation.value === null) {
    return 'Unknown';
  }
  if (typeof observation.value === 'boolean') {
    return observation.value ? 'Yes' : 'No';
  }
  return String(observation.value);
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

function ReadyObservation({ snapshot }: { snapshot: AdapterSnapshot }) {
  if (
    snapshot.event.type !== 'card.selected' ||
    snapshot.event.payload.card === null
  ) {
    return (
      <StateNotice
        eyebrow="Adapter warning"
        title="Observation mismatch"
        detail="The stored event did not contain a selected card. Observe again."
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
        title="Observing selected card…"
        detail="Only normalized card fields cross the adapter boundary."
      />
    );
  }

  if (state.kind === 'disconnected') {
    return (
      <StateNotice
        eyebrow="Waiting for EA"
        title="No Web App observation yet"
        detail="Open the EA Web App, visit My Club Players, and select a card."
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

export function App() {
  const { state, observeSelectedCard } = useAdapterPanelState();

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Personal FUT workspace</p>
        <h1>FUT Copilot</h1>
        <p className="hero__summary">
          Read the selected visible card, preserve uncertainty, and keep every
          game action manual.
        </p>
      </header>

      <section className="context" aria-labelledby="context-title">
        <div className="section-heading">
          <h2 id="context-title">Context</h2>
          <span>FC 26 adapter</span>
        </div>
        <ObservationContent state={state} />
        <button
          className="observe-button"
          onClick={observeSelectedCard}
          type="button"
        >
          Observe selected card
        </button>
      </section>

      <aside className="boundary" aria-label="Account safety boundary">
        <strong>You stay in control.</strong>
        <span>No automatic buy, list, submit, discard, or quick-sell.</span>
      </aside>
    </main>
  );
}
