import { z } from 'zod';

export const localIdSchema = z.uuid();
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const confidenceSchema = z.number().min(0).max(1);
export const fcYearSchema = z.number().int().min(25).max(99);
export const platformSchema = z.enum(['playstation', 'xbox', 'pc', 'unknown']);

export type Platform = z.infer<typeof platformSchema>;
