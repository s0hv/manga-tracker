import type { Application } from 'express-serve-static-core';
import z from 'zod';

import { dbLogger } from '#server/utils/logging';
import {
  coercedIntStr,
  databaseIdStr,
  validateAdminUser,
  validateRequest,
} from '#server/utils/validators';
import { getChapters } from '@/db/chapter';
import { deleteManga, updateManga } from '@/db/elasticsearch/manga';
import { db } from '@/db/helpers';
import { getFullManga, getMangaForElastic } from '@/db/manga';
import { handleError } from '@/db/utils';
import type { MergeMangaResult } from '@/types/api/manga';
import type { SortBy } from '@/types/db/common';


const BASE_URL = '/api/manga';

export default (app: Application) => {
  app.post('/api/manga/merge',
    ...validateRequest({
      query: z.object({
        base: databaseIdStr,
        toMerge: databaseIdStr,
        service: z.optional(databaseIdStr),
      }),
    },
    validateAdminUser),
    (req, res) => {
      if (req.query.base === req.query.toMerge) {
        res.status(400).json({ error: 'Given ids are equal' });
        return;
      }

      const {
        base,
        toMerge,
        service = null,
      } = req.query;

      db.oneOrNone<MergeMangaResult>`SELECT * FROM merge_manga(${base}, ${toMerge}, ${service})`
        .then(row => {
          if (!row) {
            res.status(500).json({ error: 'No modifications done' });
            return;
          }

          // Delete old manga only if full merge
          if (!req.query.service) {
            deleteManga(toMerge)
              .then(() => dbLogger.info('Deleted manga %s from elasticsearch', req.query.toMerge))
              .catch(err => dbLogger.error(err, 'Failed to delete manga from elasticsearch'));
          } else {
            getMangaForElastic(toMerge)
              .then(manga => updateManga(manga.mangaId, manga))
              .catch(err => dbLogger.error(err, 'Failed to update merged manga to elasticsearch'));
          }

          return getMangaForElastic(base)
            .then(manga => updateManga(manga.mangaId, manga)
              .catch(err => dbLogger.error(err, 'Failed to update elasticsearch')))
            .finally(() => res.status(200).json(row));
        })
        .catch(err => handleError(err, res));
    });

  /**
   * @openapi
   * /manga/{mangaId}:
   *   get:
   *     summary: Get manga
   *     description: Get information about a manga
   *     parameters:
   *       - name: mangaId
   *         in: path
   *         required: true
   *         description: Id of the manga
   *         schema:
   *           $ref: '#/components/schemas/databaseId'
   *
   *     responses:
   *       200:
   *         description: Returns a JSON containing information about the manga
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   $ref: '#/components/schemas/fullManga'
   *               required:
   *                 - data
   *       400:
   *         $ref: '#/components/responses/validationError'
   *       404:
   *         $ref: '#/components/responses/notFound'
   */
  app.get('/api/manga/:mangaId',
    validateRequest({
      params: z.object({ mangaId: databaseIdStr }),
    }),
    (req, res) => {
      getFullManga(req.params.mangaId)
        .then(manga => {
          if (!manga) {
            res.status(404).json({ error: 'Manga not found' });
            return;
          }
          res.json({ data: manga });
        })
        .catch(err => handleError(err, res));
    });

  /**
   *  @openapi
   *  /manga/{mangaId}/chapters:
   *    get:
   *      summary: Get chapters
   *      description: >
   *        Get the chapters of a manga. Results are sorted by the release date
   *        in descending order.
   *      parameters:
   *        - name: mangaId
   *          in: path
   *          required: true
   *          description: Id of the manga
   *          schema:
   *            $ref: '#/components/schemas/databaseId'
   *
   *        - name: limit
   *          in: query
   *          required: false
   *          description: Amount of chapters to fetch.
   *          schema:
   *            type: integer
   *            minimum: 0
   *            maximum: 200
   *            default: 50
   *
   *        - name: offset
   *          in: query
   *          required: false
   *          description: Offset used when fetching.
   *          schema:
   *            type: integer
   *            minimum: 0
   *            default: 0
   *
   *        - name: sortBy
   *          in: query
   *          required: false
   *          description: The column used for sorting.
   *          schema:
   *            type: string
   *            enum: ['chapter_number', 'group', 'chapter_id', 'release_date']
   *
   *        - name: sort
   *          in: query
   *          required: false
   *          description: The sorting direction.
   *          schema:
   *            type: string
   *            enum: ['asc', 'desc']
   *
   *      responses:
   *        200:
   *          description: Returns a list of chapters and the amount of all chapters
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  data:
   *                    type: object
   *                    properties:
   *                      count:
   *                        type: integer
   *                        minimum: 0
   *                      chapters:
   *                        type: array
   *                        items:
   *                          $ref: '#/components/schemas/chapter'
   *
   *                    required:
   *                      - count
   *                      - chapters
   *
   *                required:
   *                  - data
   *        400:
   *          $ref: '#/components/responses/validationError'
   *        404:
   *          $ref: '#/components/responses/notFound'
   */
  app.get(`${BASE_URL}/:mangaId/chapters`,
    validateRequest({
      params: z.object({ mangaId: databaseIdStr }),
      query: z.object({
        limit: z.optional(coercedIntStr.pipe(
          z.int()
            .min(0)
            .max(200)
        )).default(50),
        offset: z.optional(coercedIntStr.pipe(
          z.int()
            .min(0)
        )).default(0),
        sortBy: z.string().toLowerCase().pipe(
          z.literal(['chapter_number', 'group', 'chapter_id', 'release_date'])
        ).optional(),
        sort: z.string().toLowerCase().pipe(
          z.literal(['asc', 'desc'])
        ).optional(),
        services: z.string().transform(value => value.split(','))
          .pipe(z.array(databaseIdStr).min(1).max(25))
          .optional(),
      }),
    }), (req, res) => {
      const mangaId = req.params.mangaId;

      const {
        limit,
        offset,
        sortBy: sortByColumn,
        sort,
        services,
      } = req.query;

      const sortBy: SortBy[] = [];
      const isDesc = sort === 'desc';

      if (sortByColumn === 'chapter_number') {
        sortBy.push({
          col: 'chapter_number',
          desc: isDesc,
        });
        sortBy.push({
          col: 'chapter_decimal',
          desc: isDesc,
          nullsLast: isDesc,
        });
      } else if (sortByColumn) {
        sortBy.push({
          col: sortByColumn,
          desc: isDesc,
          nullsLast: isDesc,
        });
      }

      getChapters(mangaId, limit, offset, sortBy, services)
        .then(rows => {
          if (!rows) {
            res.status(404).json({ error: 'No manga found with given id' });
            return;
          }
          res.json({ data: rows });
        })
        .catch(err => handleError(err, res));
    });
};
