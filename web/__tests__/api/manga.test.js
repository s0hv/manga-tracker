import request from 'supertest';
import { csrfMissing } from '../../utils/constants';
import { userForbidden, userUnauthorized } from '../constants';

import initServer from '../initServer';
import stopServer from '../stopServer';
import {
  adminUser,
  configureJestOpenAPI,
  expectErrorMessage,
  normalUser,
  withUser,
  getErrorMessage,
} from '../utils';

let httpServer;

beforeAll(async () => {
  ({ httpServer } = await initServer());
  await configureJestOpenAPI();
});

afterAll(async () => {
  await stopServer(httpServer);
});

describe('POST /api/manga/merge', () => {
  it('Returns 403 without CSRF token', async () => {
    await request(httpServer)
      .post('/api/manga/merge')
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('Returns 401 without user authentication', async () => {
    await request(httpServer)
      .post('/api/manga/merge')
      .csrf()
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized));
  });

  it('Returns 403 without admin rights', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .post('/api/manga/merge')
        .csrf()
        .expect(403)
        .expect(expectErrorMessage(userForbidden));
    });
  });

  it('Returns 400 with invalid base id', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/manga/merge?base=-1')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('-1', 'base'));

      await request(httpServer)
        .post('/api/manga/merge?base=NaN')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('NaN', 'base'));

      await request(httpServer)
        .post('/api/manga/merge?base=abc')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('abc', 'base'));
    });
  });

  it('Returns 400 with invalid toMerge id', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/manga/merge?toMerge=-1')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('-1', 'toMerge'));

      await request(httpServer)
        .post('/api/manga/merge?toMerge=NaN')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('NaN', 'toMerge'));

      await request(httpServer)
        .post('/api/manga/merge?toMerge=abc')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('abc', 'toMerge'));
    });
  });

  it('Returns 400 when base equals toMerge', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/manga/merge?toMerge=5&base=5')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('Given ids are equal'));
    });
  });

  it('Returns 400 with invalid service id', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/manga/merge?toMerge=1&base=2&service=-1')
        .csrf()
        .expect(400)
        .expect(res => expect(getErrorMessage(res)).toMatchSnapshot());

      await request(httpServer)
        .post('/api/manga/merge?toMerge=1&base=2&service=abc')
        .csrf()
        .expect(400)
        .expect(res => expect(getErrorMessage(res)).toMatchSnapshot());
    });
  });
});


describe('GET /api/manga/:mangaId', () => {
  it('returns 404 with non existent manga id', async () => {
    await request(httpServer)
      .get(`/api/manga/9999999`)
      .expect(404)
      .satisfiesApiSpec()
      .expect(expectErrorMessage('Manga not found'));
  });

  it('returns 400 with non positive integers', async () => {
    await request(httpServer)
      .get(`/api/manga/-1`)
      .expect(400)
      .satisfiesApiSpec()
      .expect(expectErrorMessage('-1', 'mangaId', /positive integer/));

    await request(httpServer)
      .get(`/api/manga/abc`)
      .expect(400)
      .satisfiesApiSpec()
      .expect(expectErrorMessage('abc', 'mangaId', /positive integer/));
  });

  it('returns 200 with valid manga id', async () => {
    await request(httpServer)
      .get(`/api/manga/1`)
      .expect(200)
      .satisfiesApiSpec();
  });
});

const getChapterCount = (body) => (body && body?.data?.chapters?.length) || 0;

describe('GET /api/manga/:mangaId/chapters', () => {
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
        .satisfiesApiSpec()
        .expect(200),

      request(httpServer)
        .get(`${validUrl}?limit=5`)
        .expect('Content-Type', /json/)
        .expect(200)
        .satisfiesApiSpec()
        .expect(res => expect(getChapterCount(res.body)).toBe(5)),
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
        .satisfiesApiSpec()
        .expect('Content-Type', /json/)
        .expect(200),
    ]);
  });

  it('Returns 400 with invalid sort column', async () => {
    await Promise.all([
      request(httpServer)
        .get(`${validUrl}?sortBy=test`)
        .expect('Content-Type', /json/)
        .expect(res => expect(getErrorMessage(res)).toMatchSnapshot())
        .expect(400),
    ]);
  });

  it('Returns 400 with invalid sort direction', async () => {
    await Promise.all([
      request(httpServer)
        .get(`${validUrl}?sort=test`)
        .expect('Content-Type', /json/)
        .expect(res => expect(getErrorMessage(res)).toMatchSnapshot())
        .expect(400),
    ]);
  });

  it('Returns chapters with valid sort column and direction', async () => {
    await Promise.all([
      request(httpServer)
        .get(`${validUrl}?sortBy=chapter_number&sort=desc`)
        .satisfiesApiSpec()
        .expect('Content-Type', /json/)
        .expect(200),
    ]);
  });
});
