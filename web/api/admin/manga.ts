import express from 'express';
import { body, param } from 'express-validator';
import {
  createMangaService,
  getMangaServices,
  updateMangaInfo,
  updateMangaService,
  updateMangaTitle,
} from '@/db/admin/manga';
import { requiresUser } from '@/db/auth';
import { handleError } from '@/db/utils';
import {
  deleteScheduledRun,
  getScheduledRuns,
  scheduleMangaRun,
} from '@/db/admin/management';
import {
  databaseIdValidation,
  handleValidationErrors,
  mangaIdValidation,
  serviceIdValidation,
  validateAdminUser,
} from '../../utils/validators.js';
import { getMangaForElastic } from '@/db/manga';
import { updateManga } from '@/db/elasticsearch/manga';
import { MangaStatus } from '@/types/dbTypes';
import { NoResultsError } from '@/db/errors';

export default () => {
  const router = express.Router();
  router.use([requiresUser, validateAdminUser()]);

  router.use('/:mangaId(\\d+)/scheduledRuns', [
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
    mangaIdValidation(param('mangaId')),
    serviceIdValidation(param('serviceId')),
    handleValidationErrors,
  ]);
  router.route(scheduleRunUrl)
    .post((req, res) => {
      scheduleMangaRun(req.params.mangaId, req.params.serviceId, req.user!.userId)
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
          if (rows.count > 0) {
            res.status(200).end();
          } else {
            res.status(404).end();
          }
        })
        .catch(err => handleError(err, res));
    });

  const updateTitleUrl = '/:mangaId(\\d+)/title';
  router.use(updateTitleUrl, [
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
        if (err instanceof NoResultsError) {
          res.status(404).json({ error: 'Manga not found' });
          return;
        }
        handleError(err, res);
      });
  });

  const updateInfoPath = '/:mangaId(\\d+)/info';
  router.post(updateInfoPath, ...[
    mangaIdValidation(param('mangaId')),
    body('status').isInt({ min: MangaStatus.ONGOING, max: MangaStatus.HIATUS }).toInt(),
    handleValidationErrors,
  ], (req, res) => {
    updateMangaInfo({
      status: req.body.status,
      mangaId: req.params!.mangaId,
    })
      .then(r => {
        if (r.count === 0) return res.sendStatus(404);

        res.sendStatus(200);
      })
      .catch(err => handleError(err, res));
  });

  router.get('/:mangaId(\\d+)/services', ...[
    mangaIdValidation(param('mangaId')),
    handleValidationErrors,
  ], (req, res) => {
    getMangaServices(req.params!.mangaId)
      .then(r => {
        if (r.length === 0) return res.sendStatus(404);

        res.json(r);
      })
      .catch(err => handleError(err, res));
  });

  router.post('/:mangaId(\\d+)/services/:serviceId(\\d+)', ...[
    mangaIdValidation(param('mangaId')),
    databaseIdValidation(param('serviceId')),
    body('mangaService')
      .isObject({ strict: true }),
    body('mangaService.disabled')
      .optional()
      .isBoolean({ strict: true }),
    body('mangaService.nextUpdate')
      .optional({ nullable: true })
      .isISO8601({ strict: true })
      .toDate(),
    handleValidationErrors,
  ], (req, res) => {
    updateMangaService(req.params!.mangaId, req.params!.serviceId, req.body.mangaService)
      .then(r => {
        if (r.count === 0) return res.sendStatus(404);

        res.sendStatus(200);
      })
      .catch(err => handleError(err, res));
  });

  router.post('/:mangaId(\\d+)/services/:serviceId(\\d+)/create', ...[
    mangaIdValidation(param('mangaId')),
    databaseIdValidation(param('serviceId')),
    body('mangaService')
      .isObject({ strict: true }),
    body('mangaService.titleId')
      .isString(),
    body('mangaService.feedUrl')
      .optional({ nullable: true })
      .isString(),
    handleValidationErrors,
  ], (req, res) => {
    createMangaService(req.params!.mangaId, req.params!.serviceId, req.body.mangaService)
      .then(r => {
        if (r.count === 0) return res.sendStatus(404);

        res.sendStatus(200);
      })
      .catch(err => handleError(err, res));
  });

  return router;
};
