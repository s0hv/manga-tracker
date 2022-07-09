import express from 'express';
import { body, param } from 'express-validator';
import pgPromise from 'pg-promise';
import { updateMangaTitle } from '../../db/admin/manga.js';
import { requiresUser } from '../../db/auth.js';
import { handleError } from '../../db/utils.js';
import {
  scheduleMangaRun,
  getScheduledRuns,
  deleteScheduledRun,
} from '../../db/admin/management.js';
import {
  validateAdminUser,
  mangaIdValidation,
  serviceIdValidation,
  handleValidationErrors,
} from '../../utils/validators.js';
import { getMangaForElastic } from '../../db/manga';
import { updateManga } from '../../db/elasticsearch/manga';

const { QueryResultError } = pgPromise.errors;

export default () => {
  /** @type import('express').Router */
  const router = express.Router();
  router.use(requiresUser);

  router.use('/:mangaId(\\d+)/scheduledRuns', [
    validateAdminUser(),
    mangaIdValidation(param('mangaId')),
  ]);
  router.get('/:mangaId(\\d+)/scheduledRuns', handleValidationErrors, (req, res) => {
    getScheduledRuns(req.params.mangaId)
      .then(rows => {
        res.status(200).json({
          data: rows,
        });
      })
      .catch(err => handleError(err, res));
  });

  const scheduleRunUrl = '/:mangaId(\\d+)/scheduledRun/:serviceId(\\d+)';
  router.use(scheduleRunUrl, [
    validateAdminUser(),
    mangaIdValidation(param('mangaId')),
    serviceIdValidation(param('serviceId')),
    handleValidationErrors,
  ]);
  router.route(scheduleRunUrl)
    .post((req, res) => {
      scheduleMangaRun(req.params.mangaId, req.params.serviceId, req.user.userId)
        .then(row => {
          res.status(200).json({
            inserted: row,
          });
        })
        .catch(err => handleError(err, res));
    })

    .delete((req, res) => {
      deleteScheduledRun(req.params.mangaId, req.params.serviceId)
        .then(rows => {
          if (rows.rowCount > 0) {
            res.status(200).end();
          } else {
            res.status(404).end();
          }
        })
        .catch(err => handleError(err, res));
    });

  const updateTitleUrl = '/:mangaId(\\d+)/title';
  router.use(updateTitleUrl, [
    validateAdminUser(),
    mangaIdValidation(param('mangaId')),
    body('title').isString().bail().isLength({ min: 1 }),
  ]);
  router.post(updateTitleUrl, handleValidationErrors, (req, res) => {
    updateMangaTitle(req.params.mangaId, req.body.title)
      .then(row => {
        getMangaForElastic(req.params.mangaId)
          .then(manga => updateManga(manga.mangaId, manga))
          .finally(() => {
            const msg = row ?
              `Replaced old alias with current title "${row.title}"` :
              `Alias not found. Scrapping old title`;
            res.json({ message: msg });
          });
      })
      .catch(err => {
        if (err instanceof QueryResultError) {
          res.status(err.status).json({ error: 'Manga not found' });
          return;
        }
        handleError(err, res);
      });
  });

  return router;
};
