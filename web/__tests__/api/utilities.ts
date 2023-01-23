import request, { type Test } from 'supertest';
import { csrfMissing } from '../../utils/constants';
import { userForbidden, userUnauthorized } from '../constants';
import { expectErrorMessage, normalUser, withUser } from '../utils';

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
