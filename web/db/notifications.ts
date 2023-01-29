import { NOT_NULL_VIOLATION } from 'pg-error-constants';
import camelcaseKeys from 'camelcase-keys';
import { createHelpers, type DatabaseHelpers, db } from './helpers';
import { BadRequest, NotFound } from '../utils/errors.js';
import { type DatabaseId, NotificationType } from '@/types/dbTypes';
import type {
  NotificationData,
  NotificationField,
  NotificationFieldData,
  NotificationFollow,
  NotificationManga,
} from '@/types/api/notifications';
import { groupBy } from '@/common/utilities';

type DbNotificationField = NotificationField & {
  overrideId: number | null
}

export type DbNotificationData = Omit<NotificationData, 'fields'> & {
  fields: DbNotificationField[]
}

type GetUserNotifications = {
  (userId: DatabaseId): Promise<DbNotificationData[]>,
  (userId: DatabaseId, notificationId: DatabaseId): Promise<DbNotificationData>,
}

export const getUserNotifications: GetUserNotifications = (userId: DatabaseId, notificationId?: DatabaseId) => {
  const hasNotificationId = notificationId !== undefined;

  // Not the cleanest sql but the easiest to implement
  return db.manyOrNone<DbNotificationData>`
    SELECT
           un.notification_id,
           un.use_follows,
           un.notification_type, 
           un.times_run,
           un.times_failed,
           un.disabled,
           no.group_by_manga, 
           no.destination,
           no.name,
           (SELECT json_agg(nm) FROM (
               SELECT m.manga_id, s.service_id, m.title, COALESCE(s.service_name, 'All services') as service_name FROM notification_manga 
               INNER JOIN manga m ON m.manga_id = notification_manga.manga_id
               LEFT JOIN services s ON notification_manga.service_id = s.service_id
               WHERE notification_id=un.notification_id
               ORDER BY m.manga_id) as nm
               ) as manga,
           (SELECT json_agg(nf) FROM (
               SELECT value, nf.name, nf.optional, unf.override_id FROM notification_fields nf
               LEFT JOIN user_notification_fields unf ON nf.field_id = unf.field_id AND unf.override_id IS NULL AND unf.notification_id=un.notification_id
               WHERE nf.notification_type=un.notification_type
               UNION 
               SELECT value, nf.name, nf.optional, unf.override_id FROM notification_fields nf
               INNER JOIN user_notification_fields unf ON nf.field_id = unf.field_id AND unf.notification_id=un.notification_id
               WHERE nf.notification_type=un.notification_type AND unf.override_id IS NOT NULL
               ) nf) as fields
    FROM user_notifications un
    INNER JOIN notification_options no ON un.notification_id = no.notification_id
    WHERE un.user_id=${userId} ${hasNotificationId ? db.sql` AND un.notification_id=${notificationId}` : db.sql``}
    ORDER BY un.created DESC
  `
    .then(rows => camelcaseKeys(rows, { deep: true }))
    .then(rows => rows.map(row => ({
      ...row,
      fields: row.fields.filter(v => v.overrideId === null),
      overrides: groupBy(row.fields.filter(v => v.overrideId !== null), 'overrideId', { keepOrder: false, returnAsDict: true }),
    } as DbNotificationData)))
    .then(rows => {
      if (hasNotificationId) {
        return rows[0];
      }

      return rows;
    }) as any; // This shit don't work without any
};


const updateUserNotificationFields = (t: DatabaseHelpers, fields: NotificationFieldData[], notificationId: DatabaseId, notificationType: NotificationType) => {
  return t.none`
    INSERT INTO user_notification_fields (notification_id, field_id, value)
    SELECT ${notificationId}, nf.field_id, f.value FROM
    notification_fields nf
    LEFT JOIN (VALUES ${t.sql(fields.filter(row => row.value !== null).map(row => [row.value!, row.name]))}) f (value, name) ON f.name = nf.name
    WHERE nf.notification_type=${notificationType} AND (NOT nf.optional OR f.name IS NOT NULL)`
    .catch(err => {
      if (err?.code === NOT_NULL_VIOLATION) {
        throw new BadRequest('Not all required fields given');
      }
      throw err;
    });
};

export type CreateUserNotification<T extends boolean> = {
  notificationType: NotificationType
  userId: DatabaseId
  useFollows: T
  disabled: boolean

  groupByManga: boolean
  destination: string
  name?: string | null

  manga: T extends true ? null : NotificationManga[]
  fields: NotificationFieldData[]
}

export const createUserNotification = <T extends boolean>({
  notificationType,
  userId,
  useFollows,
  disabled,

  groupByManga,
  destination,
  name,

  manga,
  fields,
}: CreateUserNotification<T>) => db.sql.begin(async sql => {
    const t: DatabaseHelpers = createHelpers(sql);
    const { notificationId } = await t.one<{ notificationId: number }>`INSERT INTO user_notifications (notification_type, user_id, use_follows, disabled)
    VALUES (${notificationType}, ${userId}, ${useFollows}, ${disabled}) RETURNING notification_id`;

    const batch = [];
    batch.push(updateUserNotificationFields(t, fields, notificationId, notificationType));

    batch.push(t.none`INSERT INTO notification_options ${t.sql({ notificationId, groupByManga, destination, name })}`);

    if (!useFollows) {
      const mangaValues = manga!.map(row => ({
        manga_id: row.mangaId,
        service_id: row.serviceId,
        notification_id: notificationId,
      }));

      batch.push(t.none`INSERT INTO notification_manga ${t.sql(mangaValues)}`);
    }

    return Promise.all(batch)
      .then(() => notificationId);
  });

export type UpsertNotificationOverride = {
  notificationId: DatabaseId,
  userId: DatabaseId,
  overrideId: DatabaseId,
  fields: NotificationFieldData[],
}

export const upsertNotificationOverride = ({
  notificationId,
  userId,
  overrideId,
  fields,
}: UpsertNotificationOverride): Promise<void> => db.sql.begin(async sql => {
  const t: DatabaseHelpers = createHelpers(sql);

  // Make sure user has actually created the notification
  const { notificationType } = await t.one<{notificationType: number}>`SELECT notification_type FROM user_notifications WHERE user_id=${userId} AND notification_id=${notificationId}`
    .catch(() => {
      throw new NotFound(`No notification found for user with notification id ${notificationId}`);
    });

  if (!notificationType) return;

  await t.none`DELETE FROM user_notification_fields WHERE notification_id=${notificationId} AND override_id=${overrideId}`;

  if (fields.length === 0) return;

  await t.none`
    INSERT INTO user_notification_fields (notification_id, field_id, value, override_id)
    SELECT ${notificationId}, nf.field_id, f.value, ${overrideId} FROM
    notification_fields nf
    LEFT JOIN (VALUES ${t.sql(fields.filter(row => row.value !== null).map(row => [row.value!, row.name]))}) f (value, name) ON f.name = nf.name
    WHERE nf.notification_type=${notificationType} AND f.name IS NOT NULL`;
});

export type UpdateUserNotification<T extends boolean> = CreateUserNotification<T> & {
  notificationId: DatabaseId
}

export const updateUserNotification = <T extends boolean>({
  notificationId,
  userId,
  notificationType,
  useFollows,
  disabled,

  groupByManga,
  destination,
  name,

  manga,
  fields,
}: UpdateUserNotification<T>) => db.sql.begin(async sql => {
    const t = createHelpers(sql);
    const batch = [];
    const { count } = await t.sql`UPDATE user_notifications SET use_follows=${useFollows}, disabled=${disabled} WHERE notification_id=${notificationId} AND user_id=${userId}`;

    if (count !== 1) {
      throw new NotFound(`No notification found for user with notification id ${notificationId}`);
    }

    batch.push(t.none`UPDATE notification_options SET group_by_manga=${groupByManga}, destination=${destination}, name=${name} WHERE notification_id=${notificationId}`);

    await Promise.all([
      t.none`DELETE FROM notification_manga WHERE notification_id=${notificationId}`,
      t.none`DELETE FROM user_notification_fields WHERE notification_id=${notificationId}`,
    ]);

    if (!useFollows) {
      const mangaValues = manga!.map(row => ({
        manga_id: row.mangaId,
        service_id: row.serviceId,
        notification_id: notificationId,
      }));

      batch.push(t.none`INSERT INTO notification_manga ${t.sql(mangaValues)}`);
    }

    batch.push(updateUserNotificationFields(t, fields, notificationId, notificationType));

    return Promise.all(batch);
  });

export type DeleteUserNotification = {
  notificationId: DatabaseId
  userId: DatabaseId
}

export const deleteUserNotification = ({
  notificationId,
  userId,
}: DeleteUserNotification) => db.sql.begin(async sql => {
  const t = createHelpers(sql);
  await t.one`SELECT 1 FROM user_notifications WHERE user_id=${userId} AND notification_id=${notificationId}`
    .catch(() => {
      throw new NotFound(`No notification found for user with notification id ${notificationId}`);
    });

  const batches = [
    t.none`DELETE FROM notification_options WHERE notification_id=${notificationId}`,
    t.none`DELETE FROM user_notification_fields WHERE notification_id=${notificationId}`,
    t.none`DELETE FROM notification_manga WHERE notification_id=${notificationId}`,
  ];

  await Promise.all(batches);

  return t.none`DELETE FROM user_notifications WHERE notification_id=${notificationId}`;
});

export const listNotificationFollows = (userId: DatabaseId): Promise<NotificationFollow[]> => {
  return db.any<NotificationFollow>`
  SELECT uf.manga_id, uf.service_id,  m.title, COALESCE(s.service_name, 'All services') as service_name
  FROM user_follows uf
  INNER JOIN manga m ON uf.manga_id = m.manga_id
  LEFT JOIN services s ON s.service_id = uf.service_id
  WHERE uf.user_id=${userId}
  ORDER BY uf.manga_id, uf.service_id`;
};
