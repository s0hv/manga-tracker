import * as z from 'zod';

/**
 * Raw shape of `getUserNotifications`'s result, before the nested `json_agg` `manga`/`fields`
 * values (whose keys are unaffected by the shallow top-level camelCase transform) are
 * deep-camelCased.
 */
export const NotificationRawRow = z.strictObject({
  notificationId: z.int(),
  useFollows: z.boolean().nullable(),
  notificationType: z.int(),
  timesRun: z.int().nullable(),
  timesFailed: z.int().nullable(),
  disabled: z.boolean(),
  groupByManga: z.boolean(),
  destination: z.string(),
  name: z.string().nullable(),
  manga: z.array(z.strictObject({
    manga_id: z.int(),
    service_id: z.int().nullable(),
    title: z.string(),
    service_name: z.string(),
  })).nullable(),
  fields: z.array(z.strictObject({
    value: z.string().nullable(),
    name: z.string(),
    optional: z.boolean(),
    override_id: z.int().nullable(),
  })).nullable(),
});

export type NotificationRawRow = z.infer<typeof NotificationRawRow>;

export const NotificationFollowRow = z.strictObject({
  mangaId: z.int(),
  serviceId: z.int().nullable(),
  title: z.string(),
  serviceName: z.string(),
});

export type NotificationFollowRow = z.infer<typeof NotificationFollowRow>;
