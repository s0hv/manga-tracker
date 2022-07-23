import request from 'supertest';
import { csrfMissing } from '../../utils/constants';
import { userForbidden, userUnauthorized } from '../constants';
import { expectErrorMessage, normalUser, withUser } from '../utils';

export interface HttpServerReference {
  httpServer: any
}

export const apiRequiresUserTests = (ref: HttpServerReference, url: string) => {
  it('Returns 403 without CSRF token', async () => {
    await request(ref.httpServer)
      .post(url)
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('returns unauthorized without user', async () => {
    await request(ref.httpServer)
      .post(url)
      .csrf()
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized));
  });
};

export const apiRequiresAdminUserTests = (ref: HttpServerReference, url: string) => {
  apiRequiresUserTests(ref, url);

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
