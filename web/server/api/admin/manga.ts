import express from 'express';
import * as z from 'zod';

import {
  databaseIdStr,
  validateAdminUser,
  validateRequest,
} from '#server/utils/validators';
import {
  deleteScheduledRun,
  getScheduledRuns,
  scheduleMangaRun,
} from '@/db/admin/management';
import {
  createMangaService,
  getMangaServices,
  updateMangaInfo,
  updateMangaService,
  updateMangaTitle,
} from '@/db/admin/manga';
import { updateManga } from '@/db/elasticsearch/manga';
import { NoResultsError } from '@/db/errors';
import { getMangaForElastic } from '@/db/manga';
import { handleError } from '@/db/utils';
import { MangaStatus } from '@/types/dbTypes';


export default () => {
  const router = express.Router();
  router.use(validateAdminUser);

  router.get('/:mangaId/scheduledRuns',
    validateRequest({
      params: z.object({ mangaId: databaseIdStr }),
    }),
    (req, res) => {
      getScheduledRuns(req.params.mangaId)
        .then(rows => {
          res.status(200).json({
            data: rows,
          });
        })
        .catch(err => handleError(err, res));
    });

  const scheduleRunUrl = '/:mangaId/scheduledRun/:serviceId';
  const scheduleRunValidator = validateRequest({
    params: z.object({
      mangaId: databaseIdStr,
      serviceId: databaseIdStr,
    }),
  });

  router.route(scheduleRunUrl)
    .post(
      scheduleRunValidator,
      (req, res) => {
        scheduleMangaRun(req.params.mangaId, req.params.serviceId, req.getUser().userId)
          .then(row => {
            res.status(200).json({
              inserted: row,
            });
          })
          .catch(err => handleError(err, res));
      }
    )

    .delete(
      scheduleRunValidator,
      (req, res) => {
        deleteScheduledRun(req.params.mangaId, req.params.serviceId)
          .then(rows => {
            if (rows.count > 0) {
              res.status(200).end();
            } else {
              res.status(404).end();
            }
          })
          .catch(err => handleError(err, res));
      }
    );

  router.post('/:mangaId/title',
    validateRequest({
      params: z.object({ mangaId: databaseIdStr }),
      body: z.strictObject({
        title: z.string().min(1),
      }),
    }),
    (req, res) => {
      updateMangaTitle(req.params.mangaId, req.body.title)
        .then(row => {
          getMangaForElastic(req.params.mangaId)
            .then(manga => updateManga(manga.mangaId, manga))
            .finally(() => {
              const msg = row
                ? `Replaced old alias with current title "${row.title}"`
                : `Alias not found. Scrapping old title`;
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

  router.post('/:mangaId/info',
    validateRequest({
      params: z.object({ mangaId: databaseIdStr }),
      body: z.strictObject({
        status: z.enum(MangaStatus),
      }),
    }),
    (req, res) => {
      updateMangaInfo({
        status: req.body.status,
        mangaId: req.params.mangaId,
      })
        .then(r => {
          if (r.count === 0) return res.sendStatus(404);

          res.sendStatus(200);
        })
        .catch(err => handleError(err, res));
    });

  router.get('/:mangaId/services',
    validateRequest({
      params: z.object({ mangaId: databaseIdStr }),
    }),
    (req, res) => {
      getMangaServices(req.params.mangaId)
        .then(r => {
          if (r.length === 0) return res.sendStatus(404);

          res.json(r);
        })
        .catch(err => handleError(err, res));
    });

  router.post('/:mangaId/services/:serviceId',
    validateRequest({
      params: z.object({ mangaId: databaseIdStr, serviceId: databaseIdStr }),
      body: z.strictObject({
        mangaService: z.strictObject({
          disabled: z.boolean().optional(),
          nextUpdate: z.iso.datetime().transform(val => new Date(val)).nullable().optional(),
        }),
      }),
    }),
    (req, res) => {
      updateMangaService(req.params.mangaId, req.params.serviceId, req.body.mangaService)
        .then(r => {
          if (r.count === 0) return res.sendStatus(404);

          res.sendStatus(200);
        })
        .catch(err => handleError(err, res));
    });

  router.post('/:mangaId/services/:serviceId/create',
    validateRequest({
      params: z.object({ mangaId: databaseIdStr, serviceId: databaseIdStr }),
      body: z.strictObject({
        mangaService: z.strictObject({
          titleId: z.string(),
          feedUrl: z.string().nullable().optional(),
        }),
      }),
    }),
    (req, res) => {
      createMangaService(req.params.mangaId, req.params.serviceId, req.body.mangaService)
        .then(r => {
          if (r.count === 0) return res.sendStatus(404);

          res.sendStatus(200);
        })
        .catch(err => handleError(err, res));
    });

  return router;
};
