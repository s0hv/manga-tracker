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
  ISE,
  type TestUser,
  userForbidden,
  userUnauthorized,
} from '../constants';

export interface HttpServerReference {
  httpServer: any
}

const optionalApiSpecTest = (req: Test, apiSpec = false): Test => {
  if (apiSpec) {
    req = req.satisfiesApiSpec();
  }

  return req;
};

export const apiRequiresUserPostTests = (ref: HttpServerReference, url: string, apiSpec = false) => {
  it('Returns 403 without CSRF token', async () => {
    await request(ref.httpServer)
      .post(url)
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('returns 401 unauthorized without user', async () => {
    await optionalApiSpecTest(request(ref.httpServer)
      .post(url)
      .csrf()
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized)), apiSpec);
  });
};

export const apiRequiresAdminUserPostTests = (ref: HttpServerReference, url: string) => {
  apiRequiresUserPostTests(ref, url);

  it('returns forbidden for non admin', async () => {
    await withUser(normalUser, async () => {
      await request(ref.httpServer)
        .post(url)
        .csrf()
        .expect(403)
        .expect(expectErrorMessage(userForbidden));
    });
  });
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

  it('returns forbidden for non admin', async () => {
    await withUser(normalUser, async () => {
      await request(ref.httpServer)
        .get(url)
        .expect(403)
        .expect(expectErrorMessage(userForbidden));
    });
  });
};

export type Method = 'get' | 'post' | 'delete';
export const expectISEOnDbError = (
  ref: HttpServerReference,
  url: string,
  {
    method = 'get',
    user = normalUser,
    custom = (_) => _,
  }: {
    method?: Method,
    user?: TestUser,
    custom?: (test: Test) => Test,
  } = {}
) => {
  it('returns 500 when database throws an error', async () => {
    await withUser(user, async () => mockDbForErrors(async () => {
      await custom(request(ref.httpServer)[method](url))
        .expect(500)
        .expect(expectErrorMessage(ISE));
    }));
  });
};
