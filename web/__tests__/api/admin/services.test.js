/* eslint-env jest */
import fetch from 'node-fetch';

import initServer from '../../initServer';
import stopServer from '../../stopServer';
import { adminUser, normalUser, withUser } from '../../utils';

let addr;
let httpServer;

beforeAll(async () => {
  ({ addr, httpServer } = await initServer());
});

afterAll(async () => stopServer(httpServer));

describe('Edit service endpoint', () => {
  it('returns unauthorized without user', async () => {
    const res = await fetch(`${addr}/api/admin/editService`,
      {
        method: 'post',
      });
    expect(res.status).toStrictEqual(401);
  });

  it('returns forbidden for non admin', async () => {
    await withUser(normalUser, async () => {
      const res = await fetch(`${addr}/api/admin/editService`,
        {
          method: 'post',
        });
      expect(res.status).toStrictEqual(403);
      await res.text();
    });
  });

  it('returns bad request for admin without data', async () => {
    await withUser(adminUser, async () => {
      const res = await fetch(`${addr}/api/admin/editService`,
        {
          method: 'post',
        });
      expect(res.status).toStrictEqual(400);
      await res.text();
    });
  });

  it('returns ok when editing with valid data', async () => {
    await withUser(adminUser, async () => {
      const res = await fetch(`${addr}/api/admin/editService`,
        {
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            service_name: 'MangaDex',
            disabled: false,
            next_update: null,
            service_id: 2,
          }),
        });
      expect(res.status).toStrictEqual(200);
    });
  });

  it('returns bad request for admin with invalid data', async () => {
    await withUser(adminUser, async () => {
      let res = await fetch(`${addr}/api/admin/editService`,
        {
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            abc: 'bad value',
            x: 100,
          }),
        });
      expect(res.status).toStrictEqual(400);

      res = await fetch(`${addr}/api/admin/editService`,
        {
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            abc: 'bad value',
            x: 100,
            service_id: 1,
          }),
        });
      expect(res.status).toStrictEqual(400);

      res = await fetch(`${addr}/api/admin/editService`,
        {
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            disabled: 'bad value',
            x: 100,
            service_id: 1,
          }),
        });
      expect(res.status).toStrictEqual(400);
    });
  });

  it('returns not found on GET', async () => {
    const res = await fetch(`${addr}/api/admin/editService`);
    expect(res.status).toStrictEqual(404);
    await res.text();
  });

  it('returns unauthorized without login', async () => {
    const res = await fetch(`${addr}/api/admin/editService`,
      {
        method: 'post',
      });
    expect(res.status).toStrictEqual(401);
  });
});
