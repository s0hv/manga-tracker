import type { Server } from 'http';

import request, { type Test } from 'supertest';
import { it } from 'vitest';

import {
  expectErrorMessage,
  mockDbForErrors,
  normalUser,
  withUser,
} from '../utils';
import { csrfMissing } from '@/serverUtils/constants';

import {
  type TestUser,
  ISE,
  userForbidden,
  userUnauthorized,
} from '../constants';

export interface HttpServerReference {
  httpServer: Server
}

export type Method = 'get' | 'post' | 'delete' | 'put';

const optionalApiSpecTest = (req: Test, apiSpec = false): Test => {
  if (apiSpec) {
    req = req.satisfiesApiSpec();
  }

  return req;
};

export const apiRequiresUserTests = (
  ref: HttpServerReference,
  url: string,
  {
    method,
    apiSpec = false,
  }: { apiSpec?: boolean, method: Exclude<Method, 'get'> }
) => {
  it('Returns 403 without CSRF token', async () => {
    await request(ref.httpServer)[method](url)
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('returns 401 unauthorized without user', async () => {
    await optionalApiSpecTest(request(ref.httpServer)[method](url)
      .csrf()
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized)), apiSpec);
  });
};

export const apiRequiresAdminUserTests = (
  ref: HttpServerReference,
  url: string,
  options: { apiSpec?: boolean, method: Exclude<Method, 'get'> }
) => {
  apiRequiresUserTests(ref, url, options);

  it('returns forbidden for non admin', async () => {
    await withUser(normalUser, async () => {
      await request(ref.httpServer)[options.method](url)
        .csrf()
        .expect(403)
        .expect(expectErrorMessage(userForbidden));
    });
  });
};

export const apiRequiresUserPostTests = (ref: HttpServerReference, url: string, apiSpec = false) => {
  apiRequiresUserTests(ref, url, { apiSpec, method: 'post' });
};

export const apiRequiresAdminUserPostTests = (ref: HttpServerReference, url: string) => {
  apiRequiresUserPostTests(ref, url);

  apiRequiresAdminUserTests(ref, url, { method: 'post' });
};

export const apiRequiresUserGetTests = (ref: HttpServerReference, url: string, apiSpec = false) => {
  it('returns unauthorized without user', async () => {
    await optionalApiSpecTest(request(ref.httpServer)
      .get(url)
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized)), apiSpec);
  });
};

export const apiRequiresAdminUserGetTests = (ref: HttpServerReference, url: string) => {
  apiRequiresUserGetTests(ref, url);

  // eslint-disable-next-line vitest/no-identical-title
  it('returns forbidden for non admin', async () => {
    await withUser(normalUser, async () => {
      await request(ref.httpServer)
        .get(url)
        .expect(403)
        .expect(expectErrorMessage(userForbidden));
    });
  });
};

export const expectISEOnDbError = (
  ref: HttpServerReference,
  url: string,
  {
    method = 'get',
    user = normalUser,
    body,
    custom = _ => _,
  }: {
    method?: Method
    user?: TestUser
    body?: string | object
    custom?: (test: Test) => Test
  } = {}
) => {
  it('returns 500 when database throws an error', async () => {
    await withUser(user, async () => mockDbForErrors(async () => {
      let testRequest = request(ref.httpServer)[method](url);

      if (method !== 'get') {
        testRequest = testRequest.csrf();
      }

      if (body !== undefined) {
        testRequest = testRequest.send(body);
      }

      await custom(testRequest)
        .expect(500)
        .expect(expectErrorMessage(ISE));
    }));
  });
};
