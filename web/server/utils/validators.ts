import { uniq } from 'es-toolkit';
import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from 'express-serve-static-core';
import { pattern } from 'iso8601-duration';
import { z } from 'zod';

import type { ZodApiError, ZodError } from '#server/models/error';

import { Forbidden, Unauthorized } from './errors';

export type ZodErrorPath = 'query' | 'params' | 'body';

export function validateRequest<
  TParams extends z.ZodType = z.ZodUnknown,
  TBody extends z.ZodType = z.ZodUnknown,
  TQuery extends z.ZodType = z.ZodUnknown
>(validations: {
  body?: TBody
  params?: TParams
  query?: TQuery
}): RequestHandler<z.output<TParams>, unknown, z.output<TBody>, z.output<TQuery>>;

export function validateRequest<
  TParams extends z.ZodType = z.ZodUnknown,
  TBody extends z.ZodType = z.ZodUnknown,
  TQuery extends z.ZodType = z.ZodUnknown
>(
  validations: {
    body?: TBody
    params?: TParams
    query?: TQuery
  },
  ...preValidations: RequestHandler<z.output<TParams>, unknown, z.output<TBody>, z.output<TQuery>>[]
): RequestHandler<z.output<TParams>, unknown, z.output<TBody>, z.output<TQuery>>[];

/**
 * Validates the request body and query params using Zod schemas.
 *
 * @param body the schema to validate the request body with
 * @param params the schema to validate the request params with
 * @param query the schema to validate the request query params with
 * @param preValidations additional validation functions to run before the main validation
 */
export function validateRequest<
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
},
...preValidations: RequestHandler<z.output<TParams>, unknown, z.output<TBody>, z.output<TQuery>>[]): RequestHandler<z.output<TParams>, unknown, z.output<TBody>, z.output<TQuery>> | RequestHandler<z.output<TParams>, unknown, z.output<TBody>, z.output<TQuery>>[] {
  const validator: RequestHandler<z.output<TParams>, unknown, z.output<TBody>, z.output<TQuery>> = async (req, res, next) => {
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

  return preValidations.length > 0
    ? [...preValidations, validator]
    : validator;
}


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
    acc[fieldName] = uniq(error.errors);
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

  if ('items' in error && error.items) {
    error.items.forEach((item, index) => {
      const nestedFieldName = fieldName
        ? `${fieldName}.${index}`
        : index.toString();

      flattenZodError(acc, item as z.core.$ZodErrorTree<unknown>, nestedFieldName);
    });
  }

  return acc;
}

export const booleanString = z.string().transform((value, ctx) => {
  switch (value) {
    case 'true':
      return true;
    case 'false':
      return false;
    default:
      ctx.issues.push({
        code: 'custom',
        message: 'Value must be either "true" or "false"',
        input: value,
      });

      return z.NEVER;
  }
});

export const positiveInt = z.int32().min(0);
export const databaseId = positiveInt;
export const coercedIntStr = z.string()
  // Custom validation to make sure only integers are allowed and
  // no other formats such as 1e3
  .refine(val => /^-?\d+$/.test(val), { error: 'Value must contain only numbers' })
  .pipe(z.coerce.number({ error: issue => {
    if (!Number.isFinite(issue.input)) {
      return 'Value must be finite';
    }

    // Fall back to the default error message
    return undefined;
  } }));

export const databaseIdStr = coercedIntStr.pipe(databaseId);
export const passwordSchema = z.string('Password must be a string')
  .trim()
  .min(8, 'Password must be between 8 and 72 characters long')
  .max(72, 'Password must be between 8 and 72 characters long');

export const iso8601Duration = z.string().refine(value => pattern.test(value), 'Value must be a valid ISO 8601 duration');

export const validateUser = <TParams, TBody, TQuery>(
  req: Request<TParams, unknown, TBody, TQuery>,
  _: Response,
  next: NextFunction
) => {
  if (!req.user) {
    throw new Unauthorized('User not authenticated');
  }
  next();
};

export const validateAdminUser = <TParams, TBody, TQuery>(
  req: Request<TParams, unknown, TBody, TQuery>,
  _: Response,
  next: NextFunction
) => {
  if (!req.user) {
    throw new Unauthorized('User not authenticated');
  }

  if (!req.user.admin) {
    throw new Forbidden('Forbidden to perform this action');
  }

  next();
};
