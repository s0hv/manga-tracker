import type { Request } from 'express-serve-static-core';

/**
 * Request with generics set to unknown.
 *
 * This prevents type errors when passing the request after
 * the `validateRequest` middleware.
 */
export type AnyRequest = Request<unknown, unknown, unknown, unknown>;
