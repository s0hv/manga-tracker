import * as z from 'zod';

/**
 * Shape of the value produced by the `interval` type parser (postgres-interval), which the
 * `interval` column type is parsed into.
 */
export const IntervalValue = z.object({
  years: z.number().optional(),
  months: z.number().optional(),
  days: z.number().optional(),
  hours: z.number().optional(),
  minutes: z.number().optional(),
  seconds: z.number().optional(),
  milliseconds: z.number().optional(),
});
