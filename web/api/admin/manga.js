const express = require('express');
const { requiresUser } = require('../../db/auth');
const { handleError } = require('../../db/utils');
const {
  scheduleMangaRun,
  getScheduledRuns,
  deleteScheduledRun,
} = require('../../db/admin/management');
const {
  validateAdminUser,
  mangaIdValidation,
  serviceIdValidation,
  handleValidationErrors,
} = require('../../utils/validators');


module.exports = () => {
  const router = express.Router();
  router.use(requiresUser);

  router.use('/:manga_id(\\d+)/scheduledRuns', [
    validateAdminUser(),
    mangaIdValidation(true),
  ]);
  router.get('/:manga_id(\\d+)/scheduledRuns', handleValidationErrors, (req, res) => {
    getScheduledRuns(req.params.manga_id)
      .then(rows => {
        res.status(200).json({
          data: rows.rows,
        });
      })
      .catch(err => handleError(err, res));
  });

  const scheduleRunUrl = '/:manga_id(\\d+)/scheduledRun/:service_id(\\d+)';
  router.use(scheduleRunUrl, [
    validateAdminUser(),
    mangaIdValidation(true),
    serviceIdValidation(true),
  ]);
  router.use(scheduleRunUrl, handleValidationErrors);
  router.route(scheduleRunUrl)
    .post((req, res) => {
      scheduleMangaRun(req.params.manga_id, req.params.service_id, req.user.user_id)
        .then(rows => {
          res.status(200).json({
            inserted: rows.rows[0],
          });
        })
        .catch(err => handleError(err, res));
    })

    .delete((req, res) => {
      deleteScheduledRun(req.params.manga_id, req.params.service_id)
        .then(rows => {
          if (rows.rowCount > 0) {
            res.status(200).end();
          } else {
            res.status(404).end();
          }
        })
        .catch(err => handleError(err, res));
    });

  return router;
};
