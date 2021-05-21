const camelcaseKeys = require('camelcase-keys');
const { query } = require('express-validator');

const { handleElasticError, extractFields } = require('../db/elasticsearch/utils');
const { hadValidationError } = require('../utils/validators');
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
  ], (req, res) => {
    if (hadValidationError(req, res)) return;

    mangaSearch(req.query.query)
      .then(result => extractFields(result, ['title'], 'manga'))
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
