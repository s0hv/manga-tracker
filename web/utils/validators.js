import { pattern } from 'iso8601-duration';
import { query, body, validationResult } from 'express-validator';
import { Forbidden, StatusError, Unauthorized } from './errors.js';

/**
 * @param {import('express-validator').ValidationChain} field
 * @returns {import('express-validator').ValidationChain}
 */
export const databaseIdValidation = (field) => field
  .isInt({ min: 0 });

// Technically the same behavior
export const limitValidation = databaseIdValidation;

export const mangaIdValidation = (field = query('mangaId')) => databaseIdValidation(field)
  .withMessage('Manga id must be a positive integer');

export const serviceIdValidation = (field = query('serviceId')) => databaseIdValidation(field)
  .withMessage('Service id must be a positive integer');

export const positiveTinyInt = (field) => query(field).isInt({ min: 0, max: 127 });

export const passwordRequired = (value, { req, path }) => {
  if (value === undefined) return true;
  if (!req.body?.password) throw new Unauthorized(`Password required for modifying ${path}`);
  return true;
};

export const newPassword = (newPass, repeatPass) => body(newPass)
  .if(body(newPass).exists())
  .custom(passwordRequired)
  .bail()
  .trim()
  .isString()
  .withMessage('Password must be a string')
  .bail()
  .isLength({ min: 8, max: 72 })
  .withMessage('Password must be between 8 and 72 characters long')
  .bail()
  .custom((value, { req }) => {
    if (req.body[repeatPass] !== value) {
      throw new Error(`${newPass} did not match ${repeatPass}`);
    }

    return true;
  });

export const validateUser = () => body('')
  .custom((value, { req }) => {
    if (!req.user) {
      throw new Unauthorized('User not authenticated');
    }
    return true;
  });

export const validateAdminUser = () => validateUser()
  .bail()
  .custom((value, { req }) => {
    if (!req.user.admin) {
      throw new Forbidden('Forbidden to perform this action');
    }
    return true;
  });

/**
 * @returns {boolean} true if validation errors occurred. false otherwise
 */
export const hadValidationError = (req, res, sendAllErrors=true) => {
  let errors = validationResult(req);
  if (!errors.isEmpty()) {
    errors = errors.array();

    const customError = errors.find(err => err.msg instanceof StatusError)?.msg;

    if (customError) {
      res.status(customError.status).json({ error: customError.message });
    } else if (sendAllErrors) {
      res.status(400).json({ error: errors });
    } else {
      res.status(400).json({ error: errors[0] });
    }

    return true;
  }

  return false;
};

export const handleValidationErrors = (req, res, next) => {
  if (hadValidationError(req, res)) return;
  next();
};

/**
 * @param {import('express-validator').ValidationChain} chain
 * @return {import('express-validator').ValidationChain}
 */
export const isISO8601Duration = (chain) => chain.custom((value) => pattern.test(value))
  .withMessage('Value must be a valid ISO 8601 duration');
