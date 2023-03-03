import { pattern } from 'iso8601-duration';
import {
  body,
  type CustomValidator,
  query,
  type ValidationChain,
  validationResult,
} from 'express-validator';
import type {
  NextFunction,
  Request,
  Response,
} from 'express-serve-static-core';
import { Forbidden, StatusError, Unauthorized } from './errors.js';

export const databaseIdValidation = (field: ValidationChain): ValidationChain => field
  .isInt({ min: 0 });

// Technically the same behavior
export const limitValidation = databaseIdValidation;

export const mangaIdValidation = (field = query('mangaId')): ValidationChain => databaseIdValidation(field)
  .withMessage('Manga id must be a positive integer');

export const serviceIdValidation = (field = query('serviceId')): ValidationChain => databaseIdValidation(field)
  .withMessage('Service id must be a positive integer');

export const positiveTinyInt = (field: string): ValidationChain => query(field).isInt({ min: 0, max: 127 });

export const passwordRequired: CustomValidator = (value, { req, path }) => {
  if (value === undefined) return true;
  if (!req.body?.password) throw new Unauthorized(`Password required for modifying ${path}`);
  return true;
};

export const credentialsAccountOnly: CustomValidator = (value, { req }) => {
  if (!req.user?.isCredentialsAccount) throw new Forbidden('This action is only available if your account is a traditional email + password account.');
  return true;
};

export const newPassword = (newPass: string, repeatPass: string): ValidationChain => body(newPass)
  .if(body(newPass).exists())
  .custom(credentialsAccountOnly)
  .bail()
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

export const validateUser = (): ValidationChain => body('')
  .custom((value, { req }) => {
    if (!req.user) {
      throw new Unauthorized('User not authenticated');
    }
    return true;
  });

export const validateAdminUser = (): ValidationChain => validateUser()
  .bail()
  .custom((value, { req }) => {
    if (!req.user?.admin) {
      throw new Forbidden('Forbidden to perform this action');
    }
    return true;
  });

/**
 * @returns {boolean} true if validation errors occurred. false otherwise
 */
export const hadValidationError = (req: Request, res: Response, sendAllErrors=true) => {
  const errorsObj = validationResult(req);
  if (!errorsObj.isEmpty()) {
    const errors = errorsObj.array();

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

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  if (hadValidationError(req, res)) return;
  next();
};


export const isISO8601Duration = (chain: ValidationChain): ValidationChain => chain.custom((value) => pattern.test(value))
  .withMessage('Value must be a valid ISO 8601 duration');
