import type { Application } from 'express-serve-static-core';
import z from 'zod';

import {
  databaseId,
  databaseIdStr,
  validateRequest,
  validateUser2,
} from '#server/utils/validators';
import { type UpdateUserNotification,
  createUserNotification,
  deleteUserNotification,
  getUserNotifications,
  listNotificationFollows,
  updateUserNotification,
  upsertNotificationOverride,
} from '@/db/notifications';
import { handleError } from '@/db/utils';


const UpdateNotificationBodyBase = z.object({
  notificationId: databaseId.optional().nullable(),
  notificationType: z.literal([1, 2]),
  groupByManga: z.boolean(),
  destination: z.string(),
  name: z.string().optional(),
  disabled: z.boolean(),
  fields: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })).nonempty(),
});

export default (app: Application) => {
  /**
   *  @openapi
   *  /notifications:
   *    get:
   *      summary: Get a list of notifications
   *      description: Lists all notifications for the authenticated user.
   *      responses:
   *        200:
   *          description: Returns the list of services
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  data:
   *                    type: array
   *                    items:
   *                      $ref: '#/components/schemas/userNotificationWithId'
   *                required:
   *                  - data
   *        401:
   *          $ref: '#/components/responses/unauthorized'
   */
  app.get('/api/notifications', validateUser2, (req, res) => {
    getUserNotifications(req.getUser().userId)
      .then(resp => res.json({ data: resp || []}))
      .catch(err => handleError(err, res));
  });

  /**
   *  @openapi
   *  /notifications:
   *    post:
   *      summary: Update or create a notification
   *      responses:
   *        200:
   *          description: Returns the full notification object on success
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  data:
   *                    $ref: '#/components/schemas/userNotificationWithId'
   *                required:
   *                  - data
   *
   *        400:
   *          $ref: '#/components/responses/validationError'
   *        401:
   *          $ref: '#/components/responses/unauthorized'
   *        404:
   *          $ref: '#/components/responses/notFound'
   */
  app.post('/api/notifications',
    ...validateRequest({
      body: z.discriminatedUnion('useFollows', [
        UpdateNotificationBodyBase.extend({
          useFollows: z.literal(true),
        }),
        UpdateNotificationBodyBase.extend({
          useFollows: z.literal(false).default(false),
          manga: z.array(
            z.object({
              mangaId: databaseId,
              serviceId: databaseId.optional().nullable(),
            }),
            'At least one manga is required when useFollows is false'
          )
            .min(0, 'At least one manga is required when useFollows is false'),
        }),
      ]),
    }, validateUser2),
    (req, res) => {
      const data = {
        ...req.body,
        userId: req.getUser().userId,
      } as UpdateUserNotification<boolean>;

      if (data.notificationId) {
        return updateUserNotification(data)
          .then(() => getUserNotifications(data.userId, data.notificationId))
          .then(notificationData => res.json({ data: notificationData }))
          .catch(err => handleError(err, res));
      }

      createUserNotification(data)
        .then(notificationId => getUserNotifications(data.userId, notificationId))
        .then(notificationData => res.json({ data: notificationData }))
        .catch(err => handleError(err, res));
    });

  /**
   *  @openapi
   *  /notifications/override:
   *    post:
   *      summary: Updates or creates an override for a notification
   *      responses:
   *        200:
   *          description: Returns the full notification object on success
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  data:
   *                    $ref: '#/components/schemas/userNotificationWithId'
   *                required:
   *                  - data
   *
   *        400:
   *          $ref: '#/components/responses/validationError'
   *        401:
   *          $ref: '#/components/responses/unauthorized'
   *        403:
   *          $ref: '#/components/responses/forbidden'
   *        404:
   *          $ref: '#/components/responses/notFound'
   */
  app.post('/api/notifications/override',
    ...validateRequest({
      body: z.object({
        notificationId: databaseId,
        overrideId: databaseId,
        fields: z.array(z.object({
          name: z.string(),
          value: z.string(),
        })),
      }),
    }, validateUser2),
    (req, res) => {
      const data = {
        ...req.body,
        userId: req.getUser().userId,
      };

      upsertNotificationOverride(data)
        .then(() => getUserNotifications(data.userId, data.notificationId))
        .then(notificationData => res.json({ data: notificationData }))
        .catch(err => handleError(err, res));
    });

  /**
   *  @openapi
   *  /notifications/{notificationId}:
   *    delete:
   *      summary: Deletes a single notification
   *      parameters:
   *        - name: notificationId
   *          in: path
   *          required: true
   *          description: Id of the notification
   *          schema:
   *            $ref: '#/components/schemas/databaseId'
   *      responses:
   *        200:
   *          description: Returns OK status when delete was successful.
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  status:
   *                    type: string
   *                    enum: ['OK']
   *                required:
   *                  - status
   *
   *        400:
   *          $ref: '#/components/responses/validationError'
   *        401:
   *          $ref: '#/components/responses/unauthorized'
   *        404:
   *          $ref: '#/components/responses/notFound'
   */
  app.delete('/api/notifications/:notificationId',
    ...validateRequest({
      params: z.object({ notificationId: databaseIdStr }),
    }, validateUser2),
    (req, res) => {
      deleteUserNotification({
        notificationId: req.params.notificationId,
        userId: req.getUser().userId,
      })
        .then(() => res.json({ status: 'OK' }))
        .catch(err => handleError(err, res));
    });

  /**
   *  @openapi
   *  /notifications/notificationFollows:
   *    get:
   *      summary: Lists user follows
   *      responses:
   *        200:
   *          description: Returns list of follows
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  data:
   *                    type: array
   *                    items:
   *                      $ref: '#/components/schemas/notificationFollow'
   *                required:
   *                  - data
   *
   *        401:
   *          $ref: '#/components/responses/unauthorized'
   */
  app.get('/api/notifications/notificationFollows',
    validateUser2,
    (req, res) => {
      listNotificationFollows(req.getUser().userId)
        .then(rows => res.json({ data: rows }))
        .catch(err => handleError(err, res));
    });
};
