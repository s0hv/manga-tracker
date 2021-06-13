import request from 'supertest';
import { addChapter } from '../../db/chapter';
import { csrfMissing } from '../../utils/constants';
import { userForbidden, userUnauthorized } from '../constants';
import initServer from '../initServer';
import stopServer from '../stopServer';
import { adminUser, expectErrorMessage, normalUser, withUser } from '../utils';

let httpServer;

beforeAll(async () => {
  ({ httpServer } = await initServer());
});


afterAll(async () => {
  await stopServer(httpServer);
});


describe('POST /api/chapter/:chapterId', () => {
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
        .send({ chapterNumber: 'abc' })
        .expect(400)
        .expect(expectErrorMessage('abc', 'chapterNumber'));

      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ chapterNumber: null })
        .expect(400)
        .expect(expectErrorMessage(null, 'chapterNumber'));

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
        .send({ chapterDecimal: 'abc' })
        .expect(400)
        .expect(expectErrorMessage('abc', 'chapterDecimal'));

      await request(httpServer)
        .post('/api/chapter/99999999')
        .csrf()
        .send({ chapterDecimal: []})
        .expect(400)
        .expect(expectErrorMessage([], 'chapterDecimal'));

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
          chapterNumber: 1,
          chapterDecimal: 5,
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
          chapterNumber: 2,
        })
        .expect(200);

      await request(httpServer)
        .post('/api/chapter/1')
        .csrf()
        .send({
          chapterDecimal: null,
        })
        .expect(200);

      // Disabled for now as group editing not allowed
      /*
      await request(httpServer)
        .post('/api/chapter/1')
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
