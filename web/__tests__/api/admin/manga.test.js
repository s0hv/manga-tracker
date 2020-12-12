import request from 'supertest';
import { deleteScheduledRun, scheduleMangaRun } from '../../../db/admin/management';

import { userForbidden, userUnauthorized } from '../../constants';
import initServer from '../../initServer';
import stopServer from '../../stopServer';
import { adminUser, normalUser, withUser, expectErrorMessage } from '../../utils';

let httpServer;

beforeAll(async () => {
  ({ httpServer } = await initServer());
});

afterAll(async () => stopServer(httpServer));

describe('POST /api/admin/manga/:manga_id/scheduledRun/:service_id', () => {
  const serviceId = 1;
  const mangaId = 1;
  const url = `/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`;

  it('returns unauthorized without user', async () => {
    await request(httpServer)
      .post(url)
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized));
  });

  it('returns forbidden for non admin', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .post(url)
        .expect(403)
        .expect(expectErrorMessage(userForbidden));
    });
  });

  it('Returns 404 with invalid params', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/admin/manga/1/scheduledRun/abc')
        .expect(404);

      await request(httpServer)
        .post('/api/admin/manga/1d2/scheduledRun/1')
        .expect(404);

      await request(httpServer)
        .post('/api/admin/manga/-1/scheduledRun/-1')
        .expect(404);
    });
  });

  it('returns ok when adding valid data', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .expect('content-type', /application\/json/)
        .expect(200)
        .expect(res => {
          expect(res.body).toBeObject();

          const inserted = res.body.inserted;
          expect(inserted).toBeObject();
          expect(inserted.service_id).toStrictEqual(serviceId);
          expect(inserted.manga_id).toStrictEqual(mangaId);
          expect(inserted.created_by).toStrictEqual(adminUser.user_id);
        });

      await deleteScheduledRun(mangaId, serviceId);
    });
  });

  it('Returns 422 with duplicate entry', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .expect('content-type', /application\/json/)
        .expect(200);

      await request(httpServer)
        .post(url)
        .expect(422);

      await deleteScheduledRun(mangaId, serviceId);
    });
  });
});

describe('DELETE /api/admin/manga/:manga_id/scheduledRun/:service_id', () => {
  const serviceId = 1;
  const mangaId = 1;
  const url = `/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`;

  it('returns unauthorized without user', async () => {
    await request(httpServer)
      .delete(url)
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized));
  });

  it('returns forbidden for non admin', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .delete(url)
        .expect(403)
        .expect(expectErrorMessage(userForbidden));
    });
  });

  it('Returns 404 with invalid params', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .delete('/api/admin/manga/1/scheduledRun/abc')
        .expect(404);

      await request(httpServer)
        .delete('/api/admin/manga/1d2/scheduledRun/1')
        .expect(404);

      await request(httpServer)
        .delete('/api/admin/manga/-1/scheduledRun/-1')
        .expect(404);
    });
  });

  it('returns ok with valid data', async () => {
    await withUser(adminUser, async () => {
      await scheduleMangaRun(mangaId, serviceId, adminUser.user_id);
      await request(httpServer)
        .delete(url)
        .expect(200);
    });
  });

  it('Returns 404 when resource does not exist', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .delete(url)
        .expect(404);
    });
  });
});

describe('GET /api/admin/manga/:manga_id/scheduledRuns', () => {
  const serviceId = 1;
  const mangaId = 2;
  const url = `/api/admin/manga/${mangaId}/scheduledRuns`;
  beforeAll(() => scheduleMangaRun(mangaId, serviceId, adminUser.user_id));
  afterAll(() => deleteScheduledRun(mangaId, serviceId));

  it('returns unauthorized without user', async () => {
    await request(httpServer)
      .get(url)
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized));
  });

  it('returns forbidden for non admin', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .get(url)
        .expect(403)
        .expect(expectErrorMessage(userForbidden));
    });
  });

  it('Returns 404 with invalid params', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .get('/api/admin/manga/abc/scheduledRun')
        .expect(404);

      await request(httpServer)
        .get('/api/admin/manga/1d2/scheduledRun/1')
        .expect(404);
    });
  });

  it('returns ok with valid data', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .get(url)
        .expect(200)
        .expect('content-type', /application\/json/)
        .expect(res => {
          expect(res.body).toBeObject();

          const data = res.body.data;
          expect(data).toBeArray();
          expect(data).toHaveLength(1);
          expect(data[0].service_id).toStrictEqual(serviceId);
          expect(data[0].manga_id).toStrictEqual(mangaId);
        });
    });
  });

  /** Does not do this at the moment
  it('Returns 404 when resource does not exist', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .delete(url)
        .expect(404);
    });
  });
  */
});
