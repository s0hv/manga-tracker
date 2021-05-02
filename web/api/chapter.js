const { body: validateBody } = require('express-validator');

const { NoColumnsError } = require('../db/errors');
const { requiresUser } = require('../db/auth');
const { editChapter, deleteChapter } = require('../db/chapter');
const { validateAdminUser, handleValidationErrors } = require('../utils/validators');
const { getChapterReleases } = require('../db/chapter');
const { handleError } = require('../db/utils');
const { dbLogger } = require('../utils/logging');


const BASE_URL = '/api/chapter';

module.exports = app => {
  app.post(`${BASE_URL}/:chapter_id(\\d+)`, requiresUser, [
    validateAdminUser(),
    validateBody('title').isString().optional(),
    validateBody('chapter_number').isInt().optional(),
    validateBody('chapter_decimal').isInt().optional({ nullable: true }),
    validateBody('group').isString().optional(),
    handleValidationErrors,
  ], (req, res) => {
    const body = req.body;
    if (!body || Object.keys(body).length === 0) {
      res.status(400).json({ error: 'Empty body' });
      return;
    }

    const chapterId = Number(req.params.chapter_id);

    req.log.info(`Updating chapter ${chapterId} with data %o`, body);

    const chapter = {
      chapterId,
      title: body.title,
      chapterNumber: body.chapter_number,
      chapterDecimal: body.chapter_decimal,
      group: body.group,
    };

    editChapter(chapter)
      .then(r => {
        if (r.rowCount > 0) {
          res.status(200).json({ message: `Successfully updated chapter ${chapterId}` });
        } else {
          res.status(404).json({ error: `Chapter with id ${chapterId} not found` });
        }
      })
      .catch(err => {
        if (err instanceof NoColumnsError) {
          res.status(400).json({ error: 'No valid values given' });
          return;
        }
        handleError(err, res);
      });
  });

  app.delete(`${BASE_URL}/:chapter_id(\\d+)`, requiresUser, [
    validateAdminUser(),
    handleValidationErrors,
  ], (req, res) => {
    deleteChapter(Number(req.params.chapter_id))
      .then(row => {
        if (row) {
          dbLogger.info(`Deleted chapter from service ${row.service_id} and identifier ${row.chapter_identifier}`);
          res.status(200).json({ message: `Successfully deleted chapter ${row.chapter_id}` });
        } else {
          res.status(404).json({ error: `Chapter with id ${req.params.chapter_id} not found` });
        }
      })
      .catch(err => {
        handleError(err, res);
      });
  });

  app.get(`${BASE_URL}/releases/:manga_id(\\d+)`, (req, res) => {
    const mangaId = Number(req.params.manga_id);
    if (Number.isNaN(mangaId)) {
      res.status(400).json({ error: 'Invalid manga id given' });
      return;
    }

    getChapterReleases(mangaId)
      .then(rows => res.status(200).json(rows))
      .catch(err => handleError(err, res));
  });
};
