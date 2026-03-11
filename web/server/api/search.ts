import camelcaseKeys from 'camelcase-keys';
import type { Application } from 'express-serve-static-core';
import { z } from 'zod';

import { booleanString, validateRequest } from '#server/utils/validators';
import { mangaSearch } from '@/db/elasticsearch/manga';
import {
  type CustomFieldFormatter,
  extractFields,
  handleElasticError,
} from '@/db/elasticsearch/utils';
import { getFullManga } from '@/db/manga';
import { handleError } from '@/db/utils';


const SearchQuerySchema = z.string('No search query specified')
  .min(2, { error: 'Query must be between 2 and 500 characters' })
  .max(500, { error: 'Query must be between 2 and 500 characters' });


export default (app: Application) => {
  app.get('/api/quicksearch',
    validateRequest({
      query: z.object({
        query: SearchQuerySchema,
        withServices: booleanString.optional().default(false),
      }),
    }),
    (req, res) => {
      let extractCustomFields: CustomFieldFormatter<boolean>;
      const { query, withServices } = req.query;

      if (withServices) {
        extractCustomFields = fields => {
          const serviceObj: { services: Record<number, string> } = { services: {}};

          if (fields['services.service_id']) {
            const names = fields['services.service_name'] ?? [];

            fields['services.service_id'].forEach((serviceId, idx) => {
              serviceObj.services[serviceId] = names[idx];
            });
          }

          return serviceObj;
        };
      }

      mangaSearch(query, 5, withServices)
        .then(result => extractFields(result, ['title'], 'manga', extractCustomFields))
        .then(results => res.json(camelcaseKeys(results)))
        .catch(err => handleElasticError(err, res));
    });

  app.get('/api/search',
    validateRequest({
      query: z.object({ query: SearchQuerySchema }),
    }),
    (req, res) => {
      const data = req.query;

      mangaSearch(data.query, 1)
        .then(extractFields)
        .then(match => {
          if (match.length === 0) {
            return res.json({ manga: null });
          }

          getFullManga(match[0].id as number)
            .then(manga => res.json({ data: manga }))
            .catch(err => handleError(err, res));
        })
        .catch(err => handleElasticError(err, res));
    });
};
