import { z } from 'zod';

import { isoDateTimeSchema } from './common';

export const observationStatusSchema = z.enum([
  'known',
  'inferred',
  'unknown',
  'stale',
]);

export const observationSourceSchema = z.enum([
  'ea-visible-ui',
  'user',
  'local-history',
  'authorized-public-data',
  'fixture',
]);

export function createObservationSchema<TValue>(
  valueSchema: z.ZodType<TValue>,
) {
  return z
    .object({
      value: valueSchema.nullable(),
      source: observationSourceSchema,
      observedAt: isoDateTimeSchema,
      status: observationStatusSchema,
      evidence: z.array(z.string().min(1)).max(12).optional(),
    })
    .superRefine((observation, context) => {
      const observedValue = (observation as { value: unknown }).value;

      if (observation.status === 'unknown' && observedValue !== null) {
        context.addIssue({
          code: 'custom',
          path: ['value'],
          message: 'Unknown observations must have a null value.',
        });
      }

      if (observation.status !== 'unknown' && observedValue === null) {
        context.addIssue({
          code: 'custom',
          path: ['value'],
          message: `${observation.status} observations require a value.`,
        });
      }
    });
}

export const stringObservationSchema = createObservationSchema(
  z.string().min(1),
);
export const integerObservationSchema = createObservationSchema(z.int());
export const booleanObservationSchema = createObservationSchema(z.boolean());

export type ObservationStatus = z.infer<typeof observationStatusSchema>;
export type ObservationSource = z.infer<typeof observationSourceSchema>;
export type Observation<TValue> = {
  value: TValue | null;
  source: ObservationSource;
  observedAt: string;
  status: ObservationStatus;
  evidence?: string[] | undefined;
};
