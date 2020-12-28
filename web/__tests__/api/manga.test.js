import request from 'supertest';
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

describe('POST /api/manga/merge', () => {
  it('Returns 401 without user authentication', async () => {
    await request(httpServer)
      .post('/api/manga/merge')
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized));
  });

  it('Returns 403 without admin rights', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .post('/api/manga/merge')
        .expect(403)
        .expect(expectErrorMessage(userForbidden));
    });
  });

  it('Returns 400 with invalid base id', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/manga/merge?base=-1')
        .expect(400)
        .expect(expectErrorMessage('-1', 'base'));

      await request(httpServer)
        .post('/api/manga/merge?base=NaN')
        .expect(400)
        .expect(expectErrorMessage('NaN', 'base'));

      await request(httpServer)
        .post('/api/manga/merge?base=abc')
        .expect(400)
        .expect(expectErrorMessage('abc', 'base'));
    });
  });

  it('Returns 400 with invalid to_merge id', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/manga/merge?to_merge=-1')
        .expect(400)
        .expect(expectErrorMessage('-1', 'to_merge'));

      await request(httpServer)
        .post('/api/manga/merge?to_merge=NaN')
        .expect(400)
        .expect(expectErrorMessage('NaN', 'to_merge'));

      await request(httpServer)
        .post('/api/manga/merge?to_merge=abc')
        .expect(400)
        .expect(expectErrorMessage('abc', 'to_merge'));
    });
  });

  it('Return 400 when base equals to_merge', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/manga/merge?to_merge=5&base=5')
        .expect(400)
        .expect(expectErrorMessage('Given ids are equal'));
    });
  });
});


describe('GET /api/manga/:manga_id', () => {
  it('returns 404 with non existent manga id', async () => {
    await request(httpServer)
      .get(`/api/manga/9999999`)
      .expect(404)
      .expect(expectErrorMessage('Manga not found'));
  });

  it('returns 404 with non positive integers', async () => {
    await request(httpServer)
      .get(`/api/manga/-1`)
      .expect(404);

    await request(httpServer)
      .get(`/api/manga/abc`)
      .expect(404);
  });

  const chapterError = 'Amount of chapters must be a positive integer';
  it('returns 400 with invalid chapter count', async () => {
    await request(httpServer)
      .get(`/api/manga/1?chapters=`)
      .expect(400)
      .expect(expectErrorMessage('', 'chapters', chapterError));

    await request(httpServer)
      .get(`/api/manga/1?chapters=abc`)
      .expect(400)
      .expect(expectErrorMessage('abc', 'chapters', chapterError));

    await request(httpServer)
      .get(`/api/manga/1?chapters=-1`)
      .expect(400)
      .expect(expectErrorMessage('-1', 'chapters', chapterError));
  });

  it('returns 200 with valid manga id and chapters', async () => {
    const checkManga = res => {
      expect(res.body).toBeObject();
      expect(res.body.manga).toBeTruthy();
    };

    await request(httpServer)
      .get(`/api/manga/1`)
      .expect(200)
      .expect(checkManga);

    await request(httpServer)
      .get(`/api/manga/1?chapters=5`)
      .expect(200)
      .expect(checkManga)
      .expect(res => expect(res.body.manga.chapters).toHaveLength(5));
  });
});


const getChapterCount = (body) => (body && body.chapters?.length) || 0;

describe('GET /api/manga/:manga_id/chapters', () => {
  const validUrl = '/api/manga/1/chapters';

  it('returns 404 with invalid manga id', async () => {
    await request(httpServer)
      .get(`/api/manga/9999999/chapters`)
      .expect(404);

    await request(httpServer)
      .get(`/api/manga/-1/chapters`)
      .expect(404);
  });

  it('returns 400 with an invalid limit', async () => {
    const errorMessage = 'Limit must be an integer between 0 and 200';
    await Promise.all([
      request(httpServer)
        .get(`${validUrl}?limit=invalid`)
        .expect('Content-Type', /json/)
        .expect(expectErrorMessage('invalid', 'limit', errorMessage))
        .expect(400),

      request(httpServer)
        .get(`${validUrl}?limit=NaN`)
        .expect('Content-Type', /json/)
        .expect(expectErrorMessage('NaN', 'limit', errorMessage))
        .expect(400),

      request(httpServer)
        .get(`${validUrl}?limit=Infinity`)
        .expect('Content-Type', /json/)
        .expect(expectErrorMessage('Infinity', 'limit', errorMessage))
        .expect(400),

      request(httpServer)
        .get(`${validUrl}?limit=-1`)
        .expect('Content-Type', /json/)
        .expect(expectErrorMessage('-1', 'limit', errorMessage))
        .expect(400),

      request(httpServer)
        .get(`${validUrl}?limit=300`)
        .expect('Content-Type', /json/)
        .expect(expectErrorMessage('300', 'limit', errorMessage))
        .expect(400),
    ]);
  });

  it('Returns chapters with valid limit', async () => {
    await Promise.all([
      request(httpServer)
        .get(`${validUrl}`)
        .expect('Content-Type', /json/)
        .expect(res => expect(getChapterCount(res.body)).toBeGreaterThan(0))
        .expect(200),

      request(httpServer)
        .get(`${validUrl}?limit=5`)
        .expect('Content-Type', /json/)
        .expect(res => expect(getChapterCount(res.body)).toEqual(5))
        .expect(200),
    ]);
  });

  it('Returns 400 with invalid offset', async () => {
    const errorMessage = 'Offset must be a positive integer';

    await Promise.all([
      request(httpServer)
        .get(`${validUrl}?offset=NaN`)
        .expect('Content-Type', /json/)
        .expect(expectErrorMessage('NaN', 'offset', errorMessage))
        .expect(400),

      request(httpServer)
        .get(`${validUrl}?offset=-1`)
        .expect('Content-Type', /json/)
        .expect(expectErrorMessage('-1', 'offset', errorMessage))
        .expect(400),
    ]);
  });

  it('Returns chapters with valid offset', async () => {
    await Promise.all([
      request(httpServer)
        .get(`${validUrl}?offset=3`)
        .expect('Content-Type', /json/)
        .expect(res => expect(getChapterCount(res.body)).toBeGreaterThan(0))
        .expect(200),
    ]);
  });
});
