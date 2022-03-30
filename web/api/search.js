const camelcaseKeys = require('camelcase-keys');
const { query } = require('express-validator');

const { handleElasticError, extractFields } = require('../db/elasticsearch/utils');
const { hadValidationError, handleValidationErrors } = require('../utils/validators');
const { handleError } = require('../db/utils');
const { getFullManga } = require('../db/manga');
const { mangaSearch } = require('../db/elasticsearch/manga');


const searchQueryValidation = query('query')
  .isString()
  .withMessage('No search query specified')
  .bail()
  .isLength({ min: 2, max: 500 })
  .withMessage('Query must be between 2 and 500 characters');


module.exports = app => {
  app.get('/api/quicksearch', [
    searchQueryValidation,
    query('withServices')
      .isBoolean()
      .bail()
      .toBoolean()
      .default(false)
      .optional(),
    handleValidationErrors,
  ], (req, res) => {
    let extractCustomFields;
    if (req.query.withServices) {
      extractCustomFields = fields => {
        const serviceObj = { services: {}};

        if (fields['services.service_id']) {
          const names = fields['services.service_name'];

          fields['services.service_id'].forEach((serviceId, idx) => {
            serviceObj.services[serviceId] = names[idx];
          });
        }

        return serviceObj;
      };
    }
    mangaSearch(req.query.query, 5, req.query.withServices)
      .then(result => extractFields(result, ['title'], 'manga', extractCustomFields))
      .then(results => res.json(camelcaseKeys(results)))
      .catch(err => handleElasticError(err, res));
  });

  app.get('/api/search', [
    searchQueryValidation,
  ], (req, res) => {
    if (hadValidationError(req, res)) return;

    mangaSearch(req.query.query, 1)
      .then(extractFields)
      .then(match => {
        if (match.length === 0) {
          return res.json({ manga: null });
        }

        getFullManga(match[0].id)
          .then(manga => res.json({ data: manga }))
          .catch(err => handleError(err, res));
      })
      .catch(err => handleElasticError(err, res));
  });
};
