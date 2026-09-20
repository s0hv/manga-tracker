import * as z from 'zod';

import { IntervalValue } from './common';

export const ServiceRow = z.strictObject({
  serviceId: z.int(),
  serviceName: z.string(),
  url: z.string(),
  disabled: z.boolean(),
  lastCheck: z.date().nullable(),
  chapterUrlFormat: z.string(),
  disabledUntil: z.date().nullable(),
  mangaUrlFormat: z.string(),
  scheduledRunsDisabledUntil: z.date().nullable(),
});

export type ServiceRow = z.infer<typeof ServiceRow>;

export const ServiceWholeRow = z.strictObject({
  serviceId: z.int(),
  feedUrl: z.string(),
  lastCheck: z.date().nullable(),
  nextUpdate: z.date().nullable(),
  lastId: z.string().nullable(),
});

export type ServiceWholeRow = z.infer<typeof ServiceWholeRow>;

export const ServiceConfigRow = z.strictObject({
  serviceId: z.int(),
  checkInterval: IntervalValue,
  scheduledRunLimit: z.int(),
  scheduledRunsEnabled: z.boolean(),
  scheduledRunInterval: IntervalValue,
});

export type ServiceConfigRow = z.infer<typeof ServiceConfigRow>;

export const ServiceForAdminRow = z.strictObject({
  id: z.int(),
  serviceName: z.string(),
  disabled: z.boolean(),
  url: z.string(),
  lastCheck: z.date().nullable(),
  nextUpdate: z.date().nullable(),
});

export type ServiceForAdminRow = z.infer<typeof ServiceForAdminRow>;

export const ServiceForApiRow = z.strictObject({
  serviceId: z.int(),
  name: z.string(),
  disabled: z.boolean(),
  url: z.string(),
  chapterUrlFormat: z.string(),
  mangaUrlFormat: z.string(),
});

export type ServiceForApiRow = z.infer<typeof ServiceForApiRow>;
