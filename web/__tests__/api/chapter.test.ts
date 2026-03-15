import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';


import initServer from '../initServer';
import stopServer from '../stopServer';
import {
  adminUser,
  configureJestOpenAPI,
  expectErrorMessage,
  normalUser,
  withUser,
} from '../utils';
import { expectISEOnDbError } from './api-test-utilities';
import { addChapter } from '@/db/chapter';
import { csrfMissing } from '@/serverUtils/constants';

import { userForbidden, userUnauthorized } from '../constants';


let httpServer: any;
const serverReference = {
  httpServer,
};


beforeAll(async () => {
  ({ httpServer } = await initServer());
  serverReference.httpServer = httpServer;
  await configureJestOpenAPI();
});


afterAll(async () => {
  await stopServer(httpServer);
});


describe('POST /api/chapter/:chapterId', () => {
  const url = '/api/chapter/1';

  expectISEOnDbError(serverReference, url, {
    user: adminUser,
    method: 'post',
    custom: req => req
      .csrf()
      .send({
        title: 'test',
      }),
  });

  it('Returns 403 without CSRF token', async () => {
    await request(httpServer)
      .post(url)
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('returns unauthorized without login', async () => {
    await request(httpServer)
      .post(url)
      .csrf()
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized));
  });

  it('returns forbidden for non admin', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .expect(403)
        .expect(expectErrorMessage(userForbidden));
    });
  });

  it('returns not found without id', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/chapter')
        .csrf()
        .expect(404);

      await request(httpServer)
        .post('/api/chapter/')
        .csrf()
        .expect(404);

      await request(httpServer)
        .post('/api/chapter/abc')
        .csrf()
        .expect(400);
    });
  });

  it('returns not found with non existent chapter id', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ title: 'a' })
        .expect(404);
    });
  });

  it('returns bad request with invalid body', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ invalidOption: 123 })
        .expect(400)
        .expect(expectErrorMessage('Unrecognized key: "invalidOption"'));

      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({})
        .expect(400)
        .expect(expectErrorMessage('Empty body'));

      // Chapter number
      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ chapterNumber: 'abc' })
        .expect(400)
        .expect(expectErrorMessage('chapterNumber', 'Invalid input: expected number, received string', 'body'));

      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ chapterNumber: null })
        .expect(400)
        .expect(expectErrorMessage('chapterNumber', 'Invalid input: expected number, received null', 'body'));

      // Title
      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ title: 123 })
        .expect(400)
        .expect(expectErrorMessage('title', 'Invalid input: expected string, received number', 'body'));

      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ title: null })
        .expect(400)
        .expect(expectErrorMessage('title', 'Invalid input: expected string, received null', 'body'));

      // Chapter decimal
      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ chapterDecimal: 'abc' })
        .expect(400)
        .expect(expectErrorMessage('chapterDecimal', 'Invalid input: expected number, received string', 'body'));

      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ chapterDecimal: []})
        .expect(400)
        .expect(expectErrorMessage('chapterDecimal', 'Invalid input: expected number, received array', 'body'));

      // Group
      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ group: []})
        .expect(400)
        .expect(expectErrorMessage('group', 'Invalid input: expected string, received array', 'body'));

      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ group: null })
        .expect(400)
        .expect(expectErrorMessage('group', 'Invalid input: expected string, received null', 'body'));

      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ title: undefined })
        .expect(400)
        .expect(expectErrorMessage('Empty body'));
    });
  });

  it('returns ok when editing successful', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          title: 'edited title',
          chapterNumber: 1,
          chapterDecimal: 5,
          group: 'test group',
        })
        .expect(200);

      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          title: 'edited title 2',
        })
        .expect(200);

      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          chapterNumber: 2,
        })
        .expect(200);

      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          chapterDecimal: null,
        })
        .expect(200);

      // Disabled for now as group editing not allowed
      /*
      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          group: 'test group 2',
        })
        .expect(200);
      */
    });
  });
});

describe('DELETE /api/chapter/:chapterId', () => {
  const url = '/api/chapter/1';

  expectISEOnDbError(serverReference, url, {
    user: adminUser,
    method: 'delete',
    custom: req => req.csrf(),
  });

  it('Returns 403 without CSRF token', async () => {
    await request(httpServer)
      .delete(url)
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('returns unauthorized without login', async () => {
    await request(httpServer)
      .delete(url)
      .csrf()
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized));
  });

  it('returns forbidden for non admin', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .delete(url)
        .csrf()
        .expect(403)
        .expect(expectErrorMessage(userForbidden));
    });
  });

  it('returns not found without id)', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .delete('/api/chapter')
        .csrf()
        .expect(404);

      await request(httpServer)
        .delete('/api/chapter/')
        .csrf()
        .expect(404);

      await request(httpServer)
        .delete('/api/chapter/abc')
        .csrf()
        .expect(400);
    });
  });

  it('returns not found with non existent chapter id', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .delete('/api/chapter/99999999')
        .csrf()
        .expect(404);
    });
  });

  it('returns ok when deleting successful', async () => {
    const chapterId = await addChapter({
      mangaId: 1,
      title: 'test',
      serviceId: 1,
      chapterNumber: 1,
      chapterIdentifier: 'test_api_chapter_delete',
    });
    expect(chapterId).toBeDefined();

    await withUser(adminUser, async () => {
      await request(httpServer)
        .delete(`/api/chapter/${chapterId}`)
        .csrf()
        .expect(200);
    });
  });
});

describe('GET /api/chapter/latest', () => {
  const url = '/api/chapter/latest';
  expectISEOnDbError(serverReference, url);

  it('Should match api spec', async () => {
    await request(httpServer)
      .get(url)
      .expect(200)
      .expect(res => {
        expect(res.body).toBeObject();
        expect(res.body.data).toBeArray();
        expect(res.body.data).not.toHaveLength(0);
      })
      .satisfiesApiSpec();
  });

  it('Should return 401 with useFollows without user', async () => {
    await request(httpServer)
      .get(`${url}?useFollows=true`)
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized));
  });

  it('Should return 400 with invalid useFollows', async () => {
    await Promise.all([
      request(httpServer)
        .get(`${url}?useFollows=yes`)
        .expect(400)
        .expect(expectErrorMessage('useFollows', 'Value must be either "true" or "false"')),

      request(httpServer)
        .get(`${url}?useFollows=tru`)
        .expect(400)
        .expect(expectErrorMessage('useFollows', 'Value must be either "true" or "false"')),

      request(httpServer)
        .get(`${url}?useFollows=no`)
        .expect(400)
        .expect(expectErrorMessage('useFollows', 'Value must be either "true" or "false"')),
    ]);
  });


  it('Should match api spec when useFollows is false', async () => {
    await request(httpServer)
      .get(`${url}?useFollows=false`)
      .expect(200)
      .expect(res => {
        expect(res.body).toBeObject();
        expect(res.body.data).toBeArray();
        expect(res.body.data).not.toHaveLength(0);
      })
      .satisfiesApiSpec();
  });

  it('Should return follows with useFollows', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .get(`${url}?useFollows=true`)
        .expect(200)
        .expect(res => {
          expect(res.body).toBeObject();
          expect(res.body.data).toBeArray();
          expect(res.body.data).not.toHaveLength(0);
        })
        .satisfiesApiSpec();
    });
  });
});

describe('GET /api/chapter/releases/:mangaId', () => {
  const url = '/api/chapter/releases';

  expectISEOnDbError(serverReference, `${url}/1`);

  it('Should return 400 with invalid manga id', async () => {
    const field = 'mangaId';

    await Promise.all([
      await request(httpServer)
        .get(`${url}/a`)
        .expect(400)
        .expect(expectErrorMessage(field, 'Value must contain only numbers', 'params')),

      await request(httpServer)
        .get(`${url}/-1`)
        .expect(400)
        .expect(expectErrorMessage(field, 'Too small: expected number to be >=0', 'params')),

      await request(httpServer)
        .get(`${url}/1e10`)
        .expect(400)
        .expect(expectErrorMessage(field, 'Value must contain only numbers', 'params')),

      await request(httpServer)
        .get(`${url}/NaN`)
        .expect(400)
        .expect(expectErrorMessage(field, 'Value must contain only numbers', 'params')),

      await request(httpServer)
        .get(`${url}/`)
        .expect(404)
        .expect(res => {
          expect(res.body).toBeEmptyObject();
        }),
    ]);
  });

  it('Should return 400 with infinite manga id', async () => {
    await request(httpServer)
      .get(`${url}/${'1'.repeat(400)}`)
      .expect(400)
      .expect(expectErrorMessage('mangaId', 'Value must be finite', 'params'));
  });

  it('Should return 200 with empty list when manga not found', async () => {
    await request(httpServer)
      .get(`${url}/0`)
      .expect(res => expect(res.body).toBeArrayOfSize(0));
  });

  it('Should return list of release dates with valid manga', async () => {
    await request(httpServer)
      .get(`${url}/1`)
      .expect(res => expect(res.body).toBeArray())
      .expect(res => {
        expect(res.body).not.toBeArrayOfSize(0);
        expect(res.body[0]).toEqual(expect.objectContaining({
          timestamp: expect.any(Number),
          count: expect.any(Number),
        }));
      });
  });
});
