import * as z from 'zod';

export const ScheduledRunRow = z.strictObject({
  mangaId: z.int(),
  serviceId: z.int(),
  createdBy: z.int().nullable(),
  createdAt: z.date(),
});

export type ScheduledRunRow = z.infer<typeof ScheduledRunRow>;
