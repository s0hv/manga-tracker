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
