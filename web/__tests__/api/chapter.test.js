import request from 'supertest';
import { addChapter } from '../../db/chapter';
import { csrfMissing } from '../../utils/constants';
import { redis } from '../../utils/ratelimits';
import { userForbidden, userUnauthorized } from '../constants';
import initServer from '../initServer';
import stopServer from '../stopServer';
import { adminUser, expectErrorMessage, normalUser, withUser } from '../utils';

let httpServer;

beforeAll(async () => {
  ({ httpServer } = await initServer());
});

beforeEach(async () => {
  await redis.flushall();
});

afterAll(async () => {
  await stopServer(httpServer);
});


describe('POST /api/chapter/:chapter_id', () => {
  it('Returns 403 without CSRF token', async () => {
    await request(httpServer)
      .post('/api/chapter/1')
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('returns unauthorized without login', async () => {
    await request(httpServer)
      .post('/api/chapter/1')
      .csrf()
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized));
  });

  it('returns forbidden for non admin', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .post('/api/chapter/1')
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
        .expect(404);
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
        .expect(expectErrorMessage('No valid values given'));

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
        .send({ chapter_number: 'abc' })
        .expect(400)
        .expect(expectErrorMessage('abc', 'chapter_number'));

      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ chapter_number: null })
        .expect(400)
        .expect(expectErrorMessage(null, 'chapter_number'));

      // Title
      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ title: 123 })
        .expect(400)
        .expect(expectErrorMessage(123, 'title'));

      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ title: null })
        .expect(400)
        .expect(expectErrorMessage(null, 'title'));

      // Chapter decimal
      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ chapter_decimal: 'abc' })
        .expect(400)
        .expect(expectErrorMessage('abc', 'chapter_decimal'));

      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ chapter_decimal: []})
        .expect(400)
        .expect(expectErrorMessage([], 'chapter_decimal'));

      // Group
      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ group: []})
        .expect(400)
        .expect(expectErrorMessage([], 'group'));

      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ group: null })
        .expect(400)
        .expect(expectErrorMessage(null, 'group'));
    });
  });

  it('returns ok when editing successful', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/chapter/1')
        .csrf()
        .send({
          title: 'edited title',
          chapter_number: 1,
          chapter_decimal: 5,
          group: 'test group',
        })
        .expect(200);

      await request(httpServer)
        .post('/api/chapter/1')
        .csrf()
        .send({
          title: 'edited title 2',
        })
        .expect(200);

      await request(httpServer)
        .post('/api/chapter/1')
        .csrf()
        .send({
          chapter_number: 2,
        })
        .expect(200);

      await request(httpServer)
        .post('/api/chapter/1')
        .csrf()
        .send({
          chapter_decimal: null,
        })
        .expect(200);

      await request(httpServer)
        .post('/api/chapter/1')
        .csrf()
        .send({
          group: 'test group 2',
        })
        .expect(200);
    });
  });
});

describe('DELETE /api/chapter/:chapter_id', () => {
  it('Returns 403 without CSRF token', async () => {
    await request(httpServer)
      .delete('/api/chapter/1')
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('returns unauthorized without login', async () => {
    await request(httpServer)
      .delete('/api/chapter/1')
      .csrf()
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized));
  });

  it('returns forbidden for non admin', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .delete('/api/chapter/1')
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
        .expect(404);
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
