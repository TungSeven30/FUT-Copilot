type FoundationItem = {
  label: string;
  detail: string;
  status: 'ready' | 'next';
};

const foundationItems: FoundationItem[] = [
  {
    label: 'Local data vault',
    detail: 'Versioned IndexedDB with portable backup and restore.',
    status: 'ready',
  },
  {
    label: 'Safety boundary',
    detail: 'Recommendations only; every EA action remains manual.',
    status: 'ready',
  },
  {
    label: 'Selected-card observer',
    detail: 'Next: connect a visible EA card to a normalized observation.',
    status: 'next',
  },
];

function StatusPill({ status }: Pick<FoundationItem, 'status'>) {
  return <span className={`status status--${status}`}>{status}</span>;
}

function FoundationCard({ detail, label, status }: FoundationItem) {
  return (
    <article className="foundation-card">
      <div className="foundation-card__heading">
        <h2>{label}</h2>
        <StatusPill status={status} />
      </div>
      <p>{detail}</p>
    </article>
  );
}

export function App() {
  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Personal FUT workspace</p>
        <h1>FUT Copilot</h1>
        <p className="hero__summary">
          The safe foundation is running. Live EA observation remains disabled
          until the adapter fixture contract passes.
        </p>
      </header>

      <section className="foundation" aria-labelledby="foundation-title">
        <div className="section-heading">
          <h2 id="foundation-title">Foundation</h2>
          <span>Milestone 1</span>
        </div>
        {foundationItems.map((item) => (
          <FoundationCard key={item.label} {...item} />
        ))}
      </section>

      <aside className="boundary" aria-label="Account safety boundary">
        <strong>You stay in control.</strong>
        <span>No automatic buy, list, submit, discard, or quick-sell.</span>
      </aside>
    </main>
  );
}
