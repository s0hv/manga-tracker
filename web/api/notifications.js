import { body, matchedData, param } from 'express-validator';
import { requiresUser } from '@/db/auth';
import {
  getUserNotifications,
  updateUserNotification,
  createUserNotification,
  deleteUserNotification,
} from '@/db/notifications';
import { handleError } from '@/db/utils';
import {
  handleValidationErrors,
  mangaIdValidation,
  serviceIdValidation,
  databaseIdValidation,
  validateUser,
} from '../utils/validators.js';


export default app => {
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
  ], (req, res) => {
    getUserNotifications(req.user.userId)
      .then(resp => res.json({ data: resp || []}))
      .catch(err => handleError(err, res));
  });

  /**
   * @param {import('express-validator').ValidationChain} field
   * @returns {import('express-validator').ValidationChain}
   */
  const ifNotUseFollows = (field) => field
    .if((_, { req }) => req.body.useFollows !== true);

  /**
   *  @openapi
   *  /notifications:
   *    post:
   *      summary: Update or create a notification
   *      responses:
   *        200:
   *          description: Returns the notification id in case a notification was created
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  data:
   *                    type: object
   *                    properties:
   *                      notificationId:
   *                        type: integer
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
  ], (req, res) => {
    const data = matchedData(req, { locations: ['body']});
    data.userId = req.user.userId;

    if (data.notificationId) {
      return updateUserNotification(data)
        .then(() => res.json({ status: 'OK' }))
        .catch(err => handleError(err, res));
    }

    createUserNotification(data)
      .then(notificationId => res.json({ data: { notificationId }}))
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
  ], (req, res) => {
    deleteUserNotification({
      notificationId: req.params.notificationId,
      userId: req.user.userId,
    })
      .then(() => res.json({ status: 'OK' }))
      .catch(err => handleError(err, res));
  });
};
