import fetch from 'node-fetch';
import initServer from '../initServer';
import stopServer from '../stopServer';
import { adminUser, normalUser, withUser } from '../utils';

let addr;
let httpServer;

beforeAll(async () => {
  ({ addr, httpServer } = await initServer());
});

afterAll(async () => {
  await stopServer(httpServer);
});

async function doRequests(address, methods, expectedStatus, opts) {
  const promises = methods.map(method => (
    fetch(address,
      {
        method,
        ...opts,
      })
      .then(res => {
        expect(res.status).toStrictEqual(expectedStatus);
      })));
  await Promise.all(promises);
}

describe('/api/chapter/:chapter_id', () => {
  it('returns unauthorized without login (post, delete)', async () => {
    await doRequests(
      `${addr}/api/chapter/1`,
      ['post', 'delete'],
      401
    );
  });

  it('returns forbidden for non admin (post, delete)', async () => {
    await withUser(normalUser, async () => {
      await doRequests(
        `${addr}/api/chapter/1`,
        ['post', 'delete'],
        403
      );
    });
  });

  it('returns not found without id (post, delete)', async () => {
    await withUser(adminUser, async () => {
      await doRequests(
        `${addr}/api/chapter`,
        ['post', 'delete'],
        404
      );

      await doRequests(
        `${addr}/api/chapter/`,
        ['post', 'delete'],
        404
      );

      await doRequests(
        `${addr}/api/chapter/abc`,
        ['post', 'delete'],
        404
      );
    });
  });

  it('returns not found with invalid chapter id', async () => {
    await withUser(adminUser, async () => {
      await doRequests(
        `${addr}/api/chapter/99999999`,
        ['post'],
        404,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title: 2 }),
        }
      );

      await doRequests(
        `${addr}/api/chapter/99999999`,
        ['delete'],
        404
      );
    });
  });

  it('returns bad request with invalid body (post)', async () => {
    await withUser(adminUser, async () => {
      await doRequests(
        `${addr}/api/chapter/99999999`,
        ['post'],
        400,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ invalidOption: 123 }),
        }
      );

      await doRequests(
        `${addr}/api/chapter/99999999`,
        ['post'],
        400,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ chapter_number: 'abc', invalidOption: 123 }),
        }
      );
    });
  });

  it('returns ok when editing successful', async () => {
    await withUser(adminUser, async () => {
      await doRequests(
        `${addr}/api/chapter/1`,
        ['post'],
        200,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'edited title',
            chapter_number: 1,
            chapter_decimal: 5,
            group: 'test group',
          }),
        }
      );
    });
  });
});
