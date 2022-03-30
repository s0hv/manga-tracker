const { NOT_NULL_VIOLATION } = require('pg-error-constants');
const { db, pgp } = require('.');
const { NotFound, BadRequest } = require('../utils/errors');


module.exports.getUserNotifications = (userId) => {
  // Not the cleanest sql but the easiest to implement
  const sql = `
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
               WHERE notification_id=un.notification_id) as nm
               ) as manga,
           (SELECT json_agg(nf) FROM (
               SELECT value, nf.name, nf.optional FROM notification_fields nf
               LEFT JOIN user_notification_fields unf  ON nf.field_id = unf.field_id
               WHERE nf.notification_type=un.notification_type AND (notification_id=un.notification_id OR notification_id IS NULL)
               ) nf) as fields
    FROM user_notifications un
    INNER JOIN notification_options no ON un.notification_id = no.notification_id
    WHERE un.user_id=$1
    ORDER BY un.created DESC
  `;

  return db.manyOrNone(sql, [userId]);
};


const updateUserNotificationFields = (t, fields, notificationId, notificationType) => {
  const fieldValues = pgp.helpers.values(fields.map(row => ({ value: row.value, name: row.name })), ['value', 'name']);
  return t.none(`
    INSERT INTO user_notification_fields (notification_id, field_id, value)
    SELECT $1, nf.field_id, f.value FROM
    notification_fields nf
    LEFT JOIN (VALUES ${fieldValues}) f (value, name) ON f.name = nf.name
    WHERE nf.notification_type=$2 AND (NOT nf.optional OR f.name IS NOT NULL)
  `, [notificationId, notificationType])
    .catch(err => {
      if (err?.code === NOT_NULL_VIOLATION) {
        throw new BadRequest('Not all required fields given');
      }
      throw err;
    });
};


module.exports.createUserNotification = ({
  notificationType,
  userId,
  useFollows,
  disabled,

  groupByManga,
  destination,
  name,

  manga,
  fields,
}) => db.tx(async t => {
  const { notificationId } = await t.one(
    `INSERT INTO user_notifications (notification_type, user_id, use_follows, disabled) 
    VALUES ($1, $2, $3, $4) RETURNING notification_id`,
    [notificationType, userId, useFollows, disabled]
  );

  const batch = [];
  batch.push(updateUserNotificationFields(t, fields, notificationId, notificationType));

  batch.push(t.none('INSERT INTO notification_options (notification_id, group_by_manga, destination, name) VALUES ($1, $2, $3, $4)',
    [notificationId, groupByManga, destination, name]));

  if (!useFollows) {
    const mangaValues = manga.map(row => ({
      manga_id: row.mangaId,
      service_id: row.serviceId,
      notification_id: notificationId,
    }));

    batch.push(t.none(pgp.helpers.insert(
      mangaValues,
      ['manga_id', 'service_id', 'notification_id'],
      'notification_manga'
    )));
  }

  return t.batch(batch)
    .then(() => notificationId);
});

module.exports.updateUserNotification = ({
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
}) => db.tx(async t => {
  const batch = [];
  const { rowCount } = await t.result(
    `UPDATE user_notifications SET use_follows=$1, disabled=$2 WHERE notification_id=$3 AND user_id=$4`,
    [useFollows, disabled, notificationId, userId]
  );

  if (rowCount !== 1) {
    throw new NotFound(`No notification found for user with notification id ${notificationId}`);
  }

  batch.push(t.none('UPDATE notification_options SET group_by_manga=$1, destination=$2, name=$4 WHERE notification_id=$3',
    [groupByManga, destination, notificationId, name]));

  await t.batch([
    t.none('DELETE FROM notification_manga WHERE notification_id=$1', [notificationId]),
    t.none(`DELETE FROM user_notification_fields WHERE notification_id=$1`, [notificationId]),
  ]);

  if (!useFollows) {
    const mangaValues = manga.map(row => ({
      manga_id: row.mangaId,
      service_id: row.serviceId,
      notification_id: notificationId,
    }));
    batch.push(t.none(pgp.helpers.insert(
      mangaValues,
      ['manga_id', 'service_id', 'notification_id'],
      'notification_manga'
    )));
  }

  batch.push(updateUserNotificationFields(t, fields, notificationId, notificationType));

  return t.batch(batch);
});

module.exports.deleteUserNotification = ({
  notificationId,
  userId,
}) => db.tx(async t => {
  await t.one('SELECT 1 FROM user_notifications WHERE user_id=$1 AND notification_id=$2',
    [userId, notificationId])
    .catch(() => {
      throw new NotFound(`No notification found for user with notification id ${notificationId}`);
    });

  const batches = [];
  batches.push(t.none('DELETE FROM notification_options WHERE notification_id=$1', [notificationId]));
  batches.push(t.none('DELETE FROM user_notification_fields WHERE notification_id=$1', [notificationId]));
  batches.push(t.none('DELETE FROM notification_manga WHERE notification_id=$1', [notificationId]));

  await t.batch(batches);

  return batches.push(t.none('DELETE FROM user_notifications WHERE notification_id=$1', [notificationId]));
});
