import camelcaseKeys from 'camelcase-keys';
import type { Application, Request, Response } from 'express-serve-static-core';
import { matchedData, query } from 'express-validator';

import { mangaSearch } from '@/db/elasticsearch/manga';
import {
  type CustomFieldFormatter,
  extractFields,
  handleElasticError,
} from '@/db/elasticsearch/utils';
import { getFullManga } from '@/db/manga';
import { handleError } from '@/db/utils';

import { handleValidationErrors } from '../utils/validators';

const searchQueryValidation = query('query')
  .isString()
  .withMessage('No search query specified')
  .bail()
  .isLength({ min: 2, max: 500 })
  .withMessage('Query must be between 2 and 500 characters');


export default (app: Application) => {
  app.get('/api/quicksearch', [
    searchQueryValidation,
    query('withServices')
      .isBoolean()
      .bail()
      .toBoolean()
      .default(false)
      .optional(),
    handleValidationErrors,
  ], (req: Request, res: Response) => {
    let extractCustomFields: CustomFieldFormatter<boolean>;

    if (req.query.withServices) {
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

    const data = matchedData<{ query: string, withServices: boolean }>(req);

    mangaSearch(data.query as string, 5, data.withServices)
      .then(result => extractFields(result, ['title'], 'manga', extractCustomFields))
      .then(results => res.json(camelcaseKeys(results)))
      .catch(err => handleElasticError(err, res));
  });

  app.get('/api/search', [
    searchQueryValidation,
    handleValidationErrors,
  ], (req: Request, res: Response) => {
    const data = matchedData<{ query: string }>(req);

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
