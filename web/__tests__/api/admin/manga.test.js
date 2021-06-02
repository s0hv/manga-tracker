import request from 'supertest';
import {
  deleteScheduledRun,
  scheduleMangaRun
} from '../../../db/admin/management';
import { getMangaPartial, getAliases } from '../../../db/manga';
import { csrfMissing } from '../../../utils/constants';

import { userForbidden, userUnauthorized } from '../../constants';
import initServer from '../../initServer';
import stopServer from '../../stopServer';
import {
  adminUser,
  normalUser,
  withUser,
  expectErrorMessage
} from '../../utils';
import { createMangaService } from '../../dbutils';

let httpServer;

beforeAll(async () => {
  ({ httpServer } = await initServer());
});

afterAll(async () => stopServer(httpServer));

describe('POST /api/admin/manga/:mangaId/scheduledRun/:serviceId', () => {
  const serviceId = 1;
  const mangaId = 1;
  const url = `/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`;

  it('Returns 403 without CSRF token', async () => {
    await request(httpServer)
      .post(url)
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('returns unauthorized without user', async () => {
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

  it('Returns 404 with invalid params', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/admin/manga/1/scheduledRun/abc')
        .csrf()
        .expect(404);

      await request(httpServer)
        .post('/api/admin/manga/1d2/scheduledRun/1')
        .csrf()
        .expect(404);

      await request(httpServer)
        .post('/api/admin/manga/-1/scheduledRun/-1')
        .csrf()
        .expect(404);
    });
  });

  it('returns ok when adding valid data', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .expect('content-type', /application\/json/)
        .expect(200)
        .expect(res => {
          expect(res.body).toBeObject();

          const inserted = res.body.inserted;
          expect(inserted).toBeObject();
          expect(inserted.serviceId).toStrictEqual(serviceId);
          expect(inserted.mangaId).toStrictEqual(mangaId);
          expect(inserted.createdBy).toStrictEqual(adminUser.userId);
        });

      await deleteScheduledRun(mangaId, serviceId);
    });
  });

  it('Returns 422 with duplicate entry', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .expect('content-type', /application\/json/)
        .expect(200);

      await request(httpServer)
        .post(url)
        .csrf()
        .expect(422);

      await deleteScheduledRun(mangaId, serviceId);
    });
  });
});

describe('DELETE /api/admin/manga/:mangaId/scheduledRun/:serviceId', () => {
  const serviceId = 1;
  const mangaId = 1;
  const url = `/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`;

  it('Returns 403 without CSRF token', async () => {
    await request(httpServer)
      .delete(url)
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('returns unauthorized without user', async () => {
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

  it('Returns 404 with invalid params', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .delete('/api/admin/manga/1/scheduledRun/abc')
        .csrf()
        .expect(404);

      await request(httpServer)
        .delete('/api/admin/manga/1d2/scheduledRun/1')
        .csrf()
        .expect(404);

      await request(httpServer)
        .delete('/api/admin/manga/-1/scheduledRun/-1')
        .csrf()
        .expect(404);
    });
  });

  it('returns ok with valid data', async () => {
    await withUser(adminUser, async () => {
      await scheduleMangaRun(mangaId, serviceId, adminUser.userId);
      await request(httpServer)
        .delete(url)
        .csrf()
        .expect(200);
    });
  });

  it('Returns 404 when resource does not exist', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .delete(url)
        .csrf()
        .expect(404);
    });
  });
});

describe('GET /api/admin/manga/:mangaId/scheduledRuns', () => {
  const serviceId = 1;
  let mangaId;
  let url;
  beforeAll(async () => {
    mangaId = await createMangaService(serviceId);
    await scheduleMangaRun(mangaId, serviceId, adminUser.userId);
    url = `/api/admin/manga/${mangaId}/scheduledRuns`;
  });

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
          expect(data[0].serviceId).toStrictEqual(serviceId);
          expect(data[0].mangaId).toStrictEqual(mangaId);
        });
    });
  });

  /** Does not do this at the moment
  it('Returns 404 when resource does not exist', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .get(url)
        .expect(404);
    });
  });
  */
});


describe('POST /api/admin/manga/:mangaId/title', () => {
  const mangaId = 1;
  const url = `/api/admin/manga/${mangaId}/title`;

  it('Returns 403 without CSRF token', async () => {
    await request(httpServer)
      .post(url)
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('returns unauthorized without user', async () => {
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

  it('returns bad request when body missing', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .expect(400)
        .expect(expectErrorMessage(undefined, 'title'));

      await request(httpServer)
        .post(url)
        .csrf()
        .send({ title: null })
        .expect(400)
        .expect(expectErrorMessage(null, 'title'));
    });
  });

  it('returns bad request when title empty', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send({ title: '' })
        .expect(400)
        .expect(expectErrorMessage('', 'title'));
    });
  });

  it('Swaps title with alias when alias given as new title', async () => {
    const oldTitle = (await getMangaPartial(mangaId)).title;
    const newTitle = (await getAliases(mangaId))[0].title;

    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send({ title: newTitle })
        .expect(200)
        .expect(/Replaced old alias/);
    });

    expect((await getMangaPartial(mangaId)).title).toStrictEqual(newTitle);
    expect((await getAliases(mangaId)).map(a => a.title)).toContain(oldTitle);
  });

  it('Removes and replaces old title when alias does not exists', async () => {
    const oldTitle = (await getMangaPartial(mangaId)).title;
    const newTitle = `${oldTitle}_test`;

    expect((await getAliases(mangaId)).map(a => a.title)).not.toContain(newTitle);

    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send({ title: newTitle })
        .expect(200)
        .expect(/Alias not found/);
    });

    expect((await getMangaPartial(mangaId)).title).toStrictEqual(newTitle);
    expect((await getAliases(mangaId)).map(a => a.title)).not.toContain(oldTitle);
  });
});
