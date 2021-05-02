import request from 'supertest';
import { csrfMissing } from '../../../utils/constants';

import { redis } from '../../../utils/ratelimits';

import { userForbidden, userUnauthorized } from '../../constants';
import initServer from '../../initServer';
import stopServer from '../../stopServer';
import { adminUser, normalUser, withUser, expectErrorMessage } from '../../utils';

let httpServer;

beforeAll(async () => {
  ({ httpServer } = await initServer());
});

beforeEach(async () => {
  await redis.flushall();
});

afterAll(async () => stopServer(httpServer));

describe('POST /api/admin/editService', () => {
  it('Returns 403 without CSRF token', async () => {
    await request(httpServer)
      .post('/api/admin/editService')
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('returns unauthorized without user', async () => {
    await request(httpServer)
      .post('/api/admin/editService')
      .csrf()
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized));
  });

  it('returns forbidden for non admin', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .post('/api/admin/editService')
        .csrf()
        .expect(403)
        .expect(expectErrorMessage(userForbidden));
    });
  });

  it('returns 400 for admin without data', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/admin/editService')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage(undefined, 'service_id'));

      await request(httpServer)
        .post('/api/admin/editService')
        .csrf()
        .send({
          service_id: 3,
        })
        .expect(400)
        .expect(expectErrorMessage('No valid fields given to update'));

      await request(httpServer)
        .post('/api/admin/editService')
        .csrf()
        .send({
          service_name: undefined,
          disabled: undefined,
          next_update: undefined,
          service_id: 3,
        })
        .expect(400)
        .expect(expectErrorMessage('No valid fields given to update'));
    });
  });

  it('Returns 400 with invalid data', async () => {
    await withUser(adminUser, async () => {
      // service_name
      await request(httpServer)
        .post('/api/admin/editService')
        .csrf()
        .send({
          service_name: [1, 2, 3],
          service_id: 3,
        })
        .expect(400)
        .expect(expectErrorMessage([1, 2, 3], 'service_name'));

      // disabled
      await request(httpServer)
        .post('/api/admin/editService')
        .csrf()
        .send({
          disabled: '2',
          service_id: 3,
        })
        .expect(400)
        .expect(expectErrorMessage('2', 'disabled'));

      await request(httpServer)
        .post('/api/admin/editService')
        .csrf()
        .send({
          disabled: null,
          service_id: 3,
        })
        .expect(400)
        .expect(expectErrorMessage(null, 'disabled'));

      // next_update
      await request(httpServer)
        .post('/api/admin/editService')
        .csrf()
        .send({
          next_update: 'abc',
          service_id: 3,
        })
        .expect(400)
        .expect(expectErrorMessage('abc', 'next_update'));

      await request(httpServer)
        .post('/api/admin/editService')
        .csrf()
        .send({
          next_update: 1602954767,
          service_id: 3,
        })
        .expect(400)
        .expect(expectErrorMessage(1602954767, 'next_update'));
    });
  });

  it('returns ok when editing with valid data', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/admin/editService')
        .csrf()
        .send({
          next_update: new Date(1602954767000),
          service_name: "Jaimini's Box",
          disabled: true,
          service_id: 3,
        })
        .expect(200);

      await request(httpServer)
        .post('/api/admin/editService')
        .csrf()
        .send({
          next_update: new Date(1205794767000),
          service_id: 3,
        })
        .expect(200);

      await request(httpServer)
        .post('/api/admin/editService')
        .csrf()
        .send({
          service_name: "Jaimini's Box",
          disabled: true,
          service_id: 3,
        })
        .expect(200);
    });
  });
});
