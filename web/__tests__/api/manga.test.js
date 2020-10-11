import request from 'supertest';

import initServer from '../initServer';
import stopServer from '../stopServer';
import { expectErrorMessage } from '../utils';

let httpServer;

beforeAll(async () => {
  ({ httpServer } = await initServer());
});

afterAll(async () => {
  await stopServer(httpServer);
});

const getChapterCount = (body) => {
  return (body && body.chapters?.length) || 0;
};

describe('GET /api/manga/:manga_id/chapters', () => {
  const validUrl = '/api/manga/1/chapters';

  it('returns 404 with invalid manga id', async () => {
    await request(httpServer)
      .get(`/api/manga/9999999/chapters`)
      .expect(404);
  });

  it('returns 400 with an invalid limit', async () => {
    await Promise.all([
      request(httpServer)
        .get(`${validUrl}?limit=invalid`)
        .expect('Content-Type', /json/)
        .expect(expectErrorMessage('limit value invalid is not a number'))
        .expect(400),

      request(httpServer)
        .get(`${validUrl}?limit=NaN`)
        .expect('Content-Type', /json/)
        .expect(expectErrorMessage('limit value NaN is not a number'))
        .expect(400),

      request(httpServer)
        .get(`${validUrl}?limit=Infinity`)
        .expect('Content-Type', /json/)
        .expect(expectErrorMessage('limit value Infinity is not a number'))
        .expect(400),

      request(httpServer)
        .get(`${validUrl}?limit=-1`)
        .expect('Content-Type', /json/)
        .expect(expectErrorMessage('limit must be between 0 and'))
        .expect(400),

      request(httpServer)
        .get(`${validUrl}?limit=300`)
        .expect('Content-Type', /json/)
        .expect(expectErrorMessage('limit must be between 0 and'))
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
    await Promise.all([
      request(httpServer)
        .get(`${validUrl}?offset=NaN`)
        .expect('Content-Type', /json/)
        .expect(expectErrorMessage('offset value NaN is not a number'))
        .expect(400),

      request(httpServer)
        .get(`${validUrl}?offset=-1`)
        .expect('Content-Type', /json/)
        .expect(expectErrorMessage('offset must be positive'))
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
