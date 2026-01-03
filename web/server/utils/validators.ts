import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from 'express-serve-static-core';
import {
  type CustomValidator,
  type ValidationChain,
  body,
  query,
  validationResult,
} from 'express-validator';
import { pattern } from 'iso8601-duration';
import { z } from 'zod';

import type { ZodApiError, ZodError } from '#server/models/error';

import { Forbidden, StatusError, Unauthorized } from './errors';

/**
 * Validates the request body and query params using Zod schemas.
 *
 * @param body the schema to validate the request body with
 * @param params the schema to validate the request params with
 * @param query the schema to validate the request query params with
 */
export const validateRequest = <
  TParams extends z.ZodType = z.ZodUnknown,
  TBody extends z.ZodType = z.ZodUnknown,
  TQuery extends z.ZodType = z.ZodUnknown
>({
  body,
  params,
  query,
}: {
  body?: TBody
  params?: TParams
  query?: TQuery
}): RequestHandler<z.output<TParams>, unknown, z.output<TBody>, z.output<TQuery>> =>
  async (req, res, next) => {
    // Parse params
    if (params) {
      const parsed = await params.safeParseAsync(req.params);

      if (!parsed.success) {
        zodErrorResponse(res, parsed.error, 'params');
        return;
      }

      req.params = parsed.data;
    }

    // Parse body
    if (body) {
      const parsed = await body.safeParseAsync(req.body);

      if (!parsed.success) {
        zodErrorResponse(res, parsed.error, 'body');

        return;
      }

      req.body = parsed.data;
    }

    // Parse query
    if (query) {
      const parsed = await query.safeParseAsync(req.query);

      if (!parsed.success) {
        zodErrorResponse(res, parsed.error, 'query');

        return;
      }

      // Patch a custom query value to the request instead of the default getter
      // https://stackoverflow.com/a/79604142
      // https://stackoverflow.com/a/79599423
      Object.defineProperty(
        req,
        'query',
        {
          ...Object.getOwnPropertyDescriptor(req, 'query'),
          writable: false,
          value: parsed.data,
        }
      );
    }

    next();
  };


/**
 * Generates an error response from the given ZodError.
 *
 * @param res the response object
 * @param error the zod error to generate the response from
 * @param prefix prefix added to each field name; e.g. `'body'`
 */
export function zodErrorResponse<T>(res: Response, error: z.ZodError<T>, prefix: string) {
  const treeifiedError = z.treeifyError(error);

  res.status(400)
    .json({
      error: flattenZodError({}, treeifiedError, prefix),
    } satisfies ZodApiError)
    .end();
}

function flattenZodError<T>(acc: ZodError, error: z.core.$ZodErrorTree<T>, fieldName = ''): ZodError {
  if (error.errors.length > 0) {
    acc[fieldName] = error.errors;
  }

  if ('properties' in error && error.properties) {
    for (const key of Object.keys(error.properties)) {
      const nestedError = error.properties[key as keyof T] as z.core.$ZodErrorTree<unknown>;

      if (!nestedError) continue;

      const nestedFieldName = fieldName
        ? `${fieldName}.${key}`
        : key;

      flattenZodError(acc, nestedError, nestedFieldName);
    }
  }

  return acc;
}

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

export const userValidator: CustomValidator = (value, { req }) => {
  if (!req.user) {
    throw new Unauthorized('User not authenticated');
  }
  return true;
};

export const validateUser = (): ValidationChain => body('')
  .custom(userValidator);

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
export const hadValidationError = (req: Request, res: Response, sendAllErrors = true): boolean => {
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


export const isISO8601Duration = (chain: ValidationChain): ValidationChain => chain.custom(value => pattern.test(value))
  .withMessage('Value must be a valid ISO 8601 duration');
