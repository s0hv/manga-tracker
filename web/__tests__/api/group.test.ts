import { Server } from 'http';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import initServer from '../initServer';
import stopServer from '../stopServer';
import {
  adminUser,
  expectErrorMessage,
  getErrorMessage,
  withUser,
} from '../utils';
import {
  type HttpServerReference,
  apiRequiresAdminUserGetTests,
} from '@/tests/api/api-test-utilities';

let httpServer: Server;
const serverReference: HttpServerReference = {
  httpServer: undefined!,
};

beforeAll(async () => {
  ({ httpServer } = await initServer());
  serverReference.httpServer = httpServer;
});

afterAll(async () => {
  await stopServer(httpServer);
});

describe('GET /api/groups/search', () => {
  const url = '/api/groups/search';

  const getUrl = (query: string) =>
    `${url}?name=${encodeURIComponent(query)}`;

  apiRequiresAdminUserGetTests(serverReference, url);

  it('Should give an error without a search query or too short query', async () => {
    await withUser(adminUser, async () => {
      await Promise.all([
        request(httpServer)
          .get(getUrl(''))
          .expect(400)
          .expect(expectErrorMessage(
            'name',
            'Too small: expected string to have >=1 characters'
          )),

        request(httpServer)
          .get(url)
          .expect(400)
          .expect(expectErrorMessage(
            'name',
            'Invalid input: expected string, received undefined'
          )),
      ]);
    });
  });

  it.each([
    ['-1'],
    ['1e10'],
    ['0'],
    ['201'],
  ])('Should give an error with an invalid limit "%s"', async limit => {
    const urlWithLimit = (limit: string) =>
      `${getUrl('test')}&limit=${encodeURIComponent(limit)}`;

    await withUser(adminUser, async () => {
      await request(httpServer)
        .get(urlWithLimit(limit))
        .expect(400)
        .expect(res => expect(getErrorMessage(res, 'limit'))
          .toMatchSnapshot());
    });
  });

  it('Should return groups when searched', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .get(getUrl('test'))
        .expect(res => {
          expect(res.body).toBeObject();
          expect(res.body.data).toMatchInlineSnapshot(`
            [
              {
                "groupId": 2,
                "name": "Test group 1",
              },
              {
                "groupId": 3,
                "name": "Test group 2",
              },
              {
                "groupId": 4,
                "name": "Test group 3",
              },
            ]
          `);
        });
    });
  });

  it('Should limit groups when limit is used', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .get(`${getUrl('test')}&limit=1`)
        .expect(res => {
          expect(res.body).toBeObject();
          expect(res.body.data).toMatchInlineSnapshot(`
            [
              {
                "groupId": 2,
                "name": "Test group 1",
              },
            ]
          `);
        });
    });
  });
});
