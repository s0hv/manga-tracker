import express from 'express';
import type { Application } from 'express-serve-static-core';
import * as z from 'zod';

import { SearchQuerySchema } from '#server/api/schemas';
import { dbLogger } from '#server/utils/logging';
import {
  coercedIntStr,
  coercedIntStrArray,
  databaseIdStr,
  validateAdminUser,
  validateRequest,
} from '#server/utils/validators';
import { MangaStatusSchema } from '@/common/schemas/common';
import { getChapters } from '@/db/chapter';
import {
  deleteManga,
  mangaSearch,
  updateManga,
} from '@/db/elasticsearch/manga';
import { extractFields, handleElasticError } from '@/db/elasticsearch/utils';
import { db, sql } from '@/db/index';
import {
  getFullManga,
  getMangaForElastic,
  getMangasForSearch,
} from '@/db/manga';
import { MergeMangaResultRow } from '@/db/schemas/manga';
import { handleError } from '@/db/utils';
import type { SortBy } from '@/types/db/common';


export const router = express.Router();

const SearchResultSchema = z.object({
  manga_id: z.int(),
});

const SearchResultArray = z.array(SearchResultSchema);

router.post('/merge',
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

    db.maybeOne(sql.type(MergeMangaResultRow)`SELECT * FROM merge_manga(${base}, ${toMerge}, ${service})`)
      .then(row => {
        if (!row) {
          res.status(500).json({ error: 'No modifications done' });
          return;
        }

        // Delete old manga only if full merge
        if (!req.query.service) {
          deleteManga(toMerge)
            .then(() => dbLogger.info('Deleted manga %s from elasticsearch', req.query.toMerge))
            .catch((err: unknown) => dbLogger.error(err, 'Failed to delete manga from elasticsearch'));
        } else {
          getMangaForElastic(toMerge)
            .then(manga => updateManga(manga.mangaId, manga))
            .catch((err: unknown) => dbLogger.error(err, 'Failed to update merged manga to elasticsearch'));
        }

        return getMangaForElastic(base)
          .then(manga => updateManga(manga.mangaId, manga)
            .catch((err: unknown) => dbLogger.error(err, 'Failed to update elasticsearch')))
          .finally(() => res.status(200).json(row));
      })
      .catch((err: unknown) => handleError(err, res));
  });

router.get('/search',
  validateRequest({
    query: z.object({
      query: SearchQuerySchema,
      serviceIds: coercedIntStrArray.optional(),
      status: coercedIntStrArray.pipe(z.array(MangaStatusSchema)).optional(),
      limit: z.optional(coercedIntStr)
        .pipe(
          z.int('Limit must be between 0 and 50').min(0).max(50).optional()
        ).default(25),
      offset: z.optional(coercedIntStr)
        .pipe(z.int().min(0).max(225).optional()),
    }),
  }), async (req, res) => {
    const {
      query,
      serviceIds,
      status,
      limit,
      offset,
    } = req.query;

    const mangaIds = await mangaSearch(query, 250)
      .then(result => extractFields(result, ['manga_id']))
      .then(SearchResultArray.parseAsync)
      .then(results => results.map(result => result.manga_id))
      .catch((err: unknown) => {
        handleElasticError(err, res);
      });

    if (!mangaIds) return;

    const { mangas, count, foundServiceIds } = await getMangasForSearch({
      mangaIds,
      serviceIds,
      mangaStatus: status,
      limit,
      offset,
    })
      .catch((err: unknown) => {
        handleError(err, res);
        throw err;
      });

    res.json({
      data: {
        searchResults: mangas,
        serviceIds: foundServiceIds,
      },
      count,
    });
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
router.get('/:mangaId',
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
      .catch((err: unknown) => handleError(err, res));
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
router.get('/:mangaId/chapters',
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
      .catch((err: unknown) => handleError(err, res));
  });

export default (app: Application) => {
  app.use('/api/manga', router);
};
