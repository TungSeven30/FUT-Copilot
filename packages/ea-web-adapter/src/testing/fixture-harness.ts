import { z } from 'zod';

const fixtureCategorySchema = z.enum([
  'selected-card',
  'active-squad',
  'pack-result',
  'player-pick',
  'duplicate',
  'sbc',
  'market',
  'unsupported',
]);

const fixtureMutationSchema = z.discriminatedUnion('operation', [
  z.object({
    atMs: z.number().int().nonnegative(),
    operation: z.literal('replace-body'),
    html: z.string(),
  }),
  z.object({
    atMs: z.number().int().nonnegative(),
    operation: z.literal('replace-inner-html'),
    selector: z.string().min(1),
    html: z.string(),
  }),
  z.object({
    atMs: z.number().int().nonnegative(),
    operation: z.literal('append-html'),
    selector: z.string().min(1),
    html: z.string(),
  }),
  z.object({
    atMs: z.number().int().nonnegative(),
    operation: z.literal('remove'),
    selector: z.string().min(1),
  }),
  z.object({
    atMs: z.number().int().nonnegative(),
    operation: z.literal('set-attribute'),
    selector: z.string().min(1),
    name: z.string().min(1),
    value: z.string(),
  }),
]);

export const fixtureScenarioSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    category: fixtureCategorySchema,
    description: z.string().min(1),
    initialHtml: z.string(),
    mutations: z.array(fixtureMutationSchema),
  })
  .superRefine((scenario, context) => {
    for (let index = 1; index < scenario.mutations.length; index += 1) {
      const previous = scenario.mutations[index - 1];
      const current = scenario.mutations[index];
      if (
        previous !== undefined &&
        current !== undefined &&
        current.atMs < previous.atMs
      ) {
        context.addIssue({
          code: 'custom',
          path: ['mutations', index, 'atMs'],
          message: 'Fixture mutations must be ordered by time.',
        });
      }
    }
  });

export type FixtureScenario = z.infer<typeof fixtureScenarioSchema>;
export type FixtureExtractionContext = {
  fixtureId: string;
  elapsedMs: number;
};
export type FixtureExtractor<TEvent> = (
  document: Document,
  context: FixtureExtractionContext,
) => TEvent[];

export class FixtureHarness<TEvent> {
  readonly #document: Document;
  readonly #extractor: FixtureExtractor<TEvent>;
  readonly #scenario: FixtureScenario;
  readonly #events: TEvent[] = [];
  #elapsedMs = 0;
  #nextMutationIndex = 0;

  constructor(input: unknown, extractor: FixtureExtractor<TEvent>) {
    this.#scenario = fixtureScenarioSchema.parse(input);
    this.#extractor = extractor;
    this.#document = document.implementation.createHTMLDocument(
      this.#scenario.id,
    );
  }

  load(): readonly TEvent[] {
    this.#document.body.innerHTML = this.#scenario.initialHtml;
    this.#elapsedMs = 0;
    this.#nextMutationIndex = 0;
    this.#events.length = 0;
    this.#extractAndRecord();
    return this.events;
  }

  advanceTo(elapsedMs: number): readonly TEvent[] {
    if (elapsedMs < this.#elapsedMs) {
      throw new Error('Fixture time cannot move backwards.');
    }

    const emitted: TEvent[] = [];
    while (this.#nextMutationIndex < this.#scenario.mutations.length) {
      const mutation = this.#scenario.mutations[this.#nextMutationIndex];
      if (mutation === undefined || mutation.atMs > elapsedMs) {
        break;
      }

      this.#elapsedMs = mutation.atMs;
      this.#applyMutation(mutation);
      emitted.push(...this.#extractAndRecord());
      this.#nextMutationIndex += 1;
    }

    this.#elapsedMs = elapsedMs;
    return emitted;
  }

  get events(): readonly TEvent[] {
    return [...this.#events];
  }

  get fixtureDocument(): Document {
    return this.#document;
  }

  #extractAndRecord(): TEvent[] {
    const extracted = this.#extractor(this.#document, {
      fixtureId: this.#scenario.id,
      elapsedMs: this.#elapsedMs,
    });
    this.#events.push(...extracted);
    return extracted;
  }

  #applyMutation(mutation: FixtureScenario['mutations'][number]): void {
    if (mutation.operation === 'replace-body') {
      this.#document.body.innerHTML = mutation.html;
      return;
    }

    const element = this.#document.querySelector(mutation.selector);
    if (element === null) {
      throw new Error(
        `Fixture mutation target was not found: ${mutation.selector}`,
      );
    }

    switch (mutation.operation) {
      case 'replace-inner-html':
        element.innerHTML = mutation.html;
        break;
      case 'append-html':
        element.insertAdjacentHTML('beforeend', mutation.html);
        break;
      case 'remove':
        element.remove();
        break;
      case 'set-attribute':
        element.setAttribute(mutation.name, mutation.value);
        break;
    }
  }
}
