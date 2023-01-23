import {
  body,
  matchedData,
  type Meta,
  param,
  type ValidationChain,
} from 'express-validator';
import type { Application, Request, Response } from 'express-serve-static-core';
import { requiresUser } from '@/db/auth';
import {
  createUserNotification,
  deleteUserNotification,
  getUserNotifications,
  listNotificationFollows,
  type UpdateUserNotification,
  updateUserNotification,
  upsertNotificationOverride,
  type UpsertNotificationOverride,
} from '@/db/notifications';
import { handleError } from '@/db/utils';
import {
  databaseIdValidation,
  handleValidationErrors,
  mangaIdValidation,
  serviceIdValidation,
  validateUser,
} from '../utils/validators.js';


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
  app.get('/api/notifications', requiresUser, [
    validateUser(),
    handleValidationErrors,
  ], (req: Request, res: Response) => {
    getUserNotifications(req.user!.userId)
      .then(resp => res.json({ data: resp || []}))
      .catch(err => handleError(err, res));
  });

  /**
   * @param {import('express-validator').ValidationChain} field
   * @returns {import('express-validator').ValidationChain}
   */
  const ifNotUseFollows = (field: ValidationChain) => field
    .if((_: any, { req }: Meta) => req.body.useFollows !== true);

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
  app.post('/api/notifications', requiresUser, [
    validateUser(),
    databaseIdValidation(body('notificationId')).optional({ nullable: true }),
    body('notificationType').isInt({ min: 1, max: 2 }),
    body('useFollows').isBoolean({ strict: true }).default(false),

    body('groupByManga').isBoolean({ strict: true }),
    body('destination').isString(),
    body('name').isString().optional(),

    body('disabled').isBoolean({ strict: true }),

    ifNotUseFollows(body('manga'))
      .isArray({ min: 1 })
      .withMessage('At least one manga is required when useFollows is false'),
    ifNotUseFollows(
      mangaIdValidation(body('manga.*.mangaId'))
    ),
    serviceIdValidation(body('manga.*.serviceId')).optional({ nullable: true }),

    body('fields').isArray({ min: 1 }),
    body('fields.*.value').isString(),
    body('fields.*.name').isString(),

    handleValidationErrors,
  ], (req: Request, res: Response) => {
    const data = matchedData(req, { locations: ['body']}) as UpdateUserNotification<boolean>;
    data.userId = req.user!.userId;

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
  app.post('/api/notifications/override', requiresUser, [
    validateUser(),
    databaseIdValidation(body('notificationId')),
    databaseIdValidation(body('overrideId')),
    body('fields').isArray(),
    body('fields.*.value').isString(),
    body('fields.*.name').isString(),

    handleValidationErrors,
  ], (req: Request, res: Response) => {
    const data = matchedData(req, { locations: ['body']}) as UpsertNotificationOverride;
    data.userId = req.user!.userId;

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
  app.delete('/api/notifications/:notificationId', requiresUser, [
    validateUser(),
    databaseIdValidation(param('notificationId')),
    handleValidationErrors,
  ], (req: Request, res: Response) => {
    deleteUserNotification({
      notificationId: req.params.notificationId,
      userId: req.user!.userId,
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
  app.get('/api/notifications/notificationFollows', requiresUser, [
    validateUser(),
    handleValidationErrors,
  ], (req: Request, res: Response) => {
    listNotificationFollows(req.user!.userId)
      .then(rows => res.json({ data: rows }))
      .catch(err => handleError(err, res));
  });
};
