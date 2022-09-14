import request from 'supertest';
import {
  deleteScheduledRun,
  scheduleMangaRun,
} from '../../../db/admin/management';
import { getMangaPartial, getAliases } from '../../../db/manga';

import { userForbidden, userUnauthorized } from '../../constants';
import initServer from '../../initServer';
import stopServer from '../../stopServer';
import {
  adminUser,
  normalUser,
  withUser,
  expectErrorMessage,
} from '../../utils';
import { createMangaService, createManga } from '../../dbutils';
import {
  apiRequiresAdminUserPostTests,
  apiRequiresAdminUserGetTests,
} from '../utilities';
import { getMangaServices } from '../../../db/admin/manga';

let httpServer;
const serverReference = {
  httpServer,
};

beforeAll(async () => {
  ({ httpServer } = await initServer());
  serverReference.httpServer = httpServer;
});

afterAll(async () => stopServer(httpServer));

describe('POST /api/admin/manga/:mangaId/scheduledRun/:serviceId', () => {
  const serviceId = 1;
  const mangaId = 1;
  const url = `/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`;

  apiRequiresAdminUserPostTests(serverReference, url);

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

  apiRequiresAdminUserPostTests(serverReference, url);

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

  it('returns ok when no rows', async () => {
    mangaId = await createMangaService(serviceId);
    url = `/api/admin/manga/${mangaId}/scheduledRuns`;
    await withUser(adminUser, async () => {
      await request(httpServer)
        .get(url)
        .expect(200)
        .expect('content-type', /application\/json/)
        .expect(res => {
          expect(res.body).toBeObject();

          const data = res.body.data;
          expect(data).toBeArray();
          expect(data).toHaveLength(0);
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

  apiRequiresAdminUserPostTests(serverReference, url);

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

  it('returns 404 when manga not found', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(`/api/admin/manga/999999/title`)
        .csrf()
        .send({ title: 'aaa' })
        .expect(404)
        .expect(expectErrorMessage('Manga not found'));
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

describe('POST /api/admin/manga/:mangaId/info', () => {
  const mangaId = 1;
  const url = `/api/admin/manga/${mangaId}/info`;

  apiRequiresAdminUserPostTests(serverReference, url);

  it('returns bad request when body missing', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .expect(400)
        .expect(expectErrorMessage(undefined, 'status'));

      await request(httpServer)
        .post(url)
        .csrf()
        .send({ status: null })
        .expect(400)
        .expect(expectErrorMessage(null, 'status'));
    });
  });

  it('returns bad request when status empty', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send({ status: '' })
        .expect(400)
        .expect(expectErrorMessage('', 'status'));
    });
  });

  it('returns bad request when status invalid', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send({ status: -1 })
        .expect(400)
        .expect(expectErrorMessage(-1, 'status'));

      await request(httpServer)
        .post(url)
        .csrf()
        .send({ status: 4 })
        .expect(400)
        .expect(expectErrorMessage(4, 'status'));
    });
  });

  it('returns 404 when manga not found', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(`/api/admin/manga/${999999}/info`)
        .csrf()
        .send({ status: 1 })
        .expect(404);
    });
  });

  it('returns 200 when manga found', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send({ status: 1 })
        .expect(200);
    });
  });
});

describe('GET /api/admin/manga/:mangaId/services', () => {
  const mangaId = 1;
  const url = `/api/admin/manga/${mangaId}/services`;

  apiRequiresAdminUserGetTests(serverReference, url);

  it('Returns 404 with invalid params', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .get('/api/admin/manga/aaa/services')
        .expect(404);

      await request(httpServer)
        .get('/api/admin/manga/1e/services')
        .expect(404);
    });
  });

  it('returns ok with valid params', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .get(url)
        .expect(200)
        .expect('content-type', /application\/json/)
        .expect(res => {
          expect(res.body).toBeArray();

          const data = res.body[0];
          expect(data).toBeObject();
          expect(data.mangaId).toStrictEqual(mangaId);
        });
    });
  });
});

describe('POST /api/admin/manga/:mangaId/services/:serviceId', () => {
  const serviceId = 1;
  const getUrl = (mangaId) => `/api/admin/manga/${mangaId}/services/${serviceId}`;
  const url = getUrl(1);

  const getMangaService = (mangaId) => getMangaServices(mangaId)
    .then(ms => ms.filter(m => m.serviceId === serviceId)[0]);


  apiRequiresAdminUserPostTests(serverReference, url);

  it('Returns 404 with invalid params', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/admin/manga/aaa/services/aaa')
        .csrf()
        .expect(404);

      await request(httpServer)
        .post('/api/admin/manga/1e/services/1e')
        .csrf()
        .expect(404);

      await request(httpServer)
        .post('/api/admin/manga/1/services/1e')
        .csrf()
        .expect(404);

      await request(httpServer)
        .post('/api/admin/manga/1/services/aaa')
        .csrf()
        .expect(404);
    });
  });

  it('Returns 400 with invalid body', async () => {
    await withUser(adminUser, async () => {
      const values = [
        [],
        null,
        'aaa',
        { mangaService: null },
        { mangaService: []},
        { mangaService: 'a' },
      ];

      await Promise.all(values.map(v => request(httpServer)
        .post(url)
        .send(v)
        .csrf()
        .expect(expectErrorMessage(v?.mangaService))));
    });
  });

  it('Returns 400 with empty body', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .send({ mangaService: {}})
        .csrf()
        .expect(expectErrorMessage('No valid columns given', 'mangaService'));
    });
  });

  it('Returns 400 with invalid keys', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .send({ mangaService: {
          mangaId: 1,
          serviceId: 1,
          lastCheck: new Date(),
          titleId: 'aaa',
          latestChapter: 1,
          latestDecimal: 1,
          feedUrl: 'aaa',
        }})
        .csrf()
        .expect(expectErrorMessage('No valid columns given', 'mangaService'));
    });
  });

  it('Returns 404 with non existent manga', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(getUrl(1212121212))
        .send({ mangaService: { disabled: true }})
        .csrf()
        .expect(404);
    });
  });

  it('Returns 200 with valid data', async () => {
    const mangaId = await createMangaService(serviceId);
    const mangaService = await getMangaService(mangaId);

    const nextUpdate = new Date(Date.now());
    const updateData = {
      disabled: !mangaService.disabled,
      nextUpdate,
    };

    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(getUrl(mangaId))
        .send({ mangaService: {
          mangaId: 1,
          serviceId: 1,
          lastCheck: new Date(),
          titleId: 'aaa',
          latestChapter: 1,
          latestDecimal: 1,
          feedUrl: 'aaa',
          ...updateData,
        }})
        .csrf()
        .expect(200);
    });

    const mangaServiceNew = await getMangaService(mangaId);
    expect({
      ...mangaService,
      ...updateData,
    }).toEqual(mangaServiceNew);
  });
});

describe('POST /api/admin/manga/:mangaId/services/:serviceId/create', () => {
  const serviceId = 1;
  const getUrl = (mangaId) => `/api/admin/manga/${mangaId}/services/${serviceId}/create`;
  const url = getUrl(1);

  const getMangaService = (mangaId) => getMangaServices(mangaId)
    .then(ms => ms.filter(m => m.serviceId === serviceId)[0]);

  apiRequiresAdminUserPostTests(serverReference, url);

  it('Returns 404 with invalid params', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/admin/manga/aaa/services/aaa/create')
        .csrf()
        .expect(404);

      await request(httpServer)
        .post('/api/admin/manga/1e/services/1e/create')
        .csrf()
        .expect(404);

      await request(httpServer)
        .post('/api/admin/manga/1/services/1e/create')
        .csrf()
        .expect(404);

      await request(httpServer)
        .post('/api/admin/manga/1/services/aaa/create')
        .csrf()
        .expect(404);
    });
  });

  it('Returns 400 with invalid body', async () => {
    await withUser(adminUser, async () => {
      const values = [
        [],
        null,
        'aaa',
        { mangaService: null },
        { mangaService: []},
        { mangaService: 'a' },
      ];

      await Promise.all(values.map(v => request(httpServer)
        .post(url)
        .send(v)
        .csrf()
        .expect(400)
        .expect(expectErrorMessage(v?.mangaService, 'mangaService'))));
    });
  });

  it('Returns 400 with empty body', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .send({ mangaService: {}})
        .csrf()
        .expect(400)
        .expect(expectErrorMessage());
    });
  });

  it('Returns 400 with invalid keys', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .send({ mangaService: {
          mangaId: 1,
          serviceId: 1,
          lastCheck: new Date(),
          disabled: 'aaa',
          latestChapter: 1,
          latestDecimal: 1,
          nextUpdate: 'aaa',
        }})
        .csrf()
        .expect(400)
        .expect(expectErrorMessage());
    });
  });

  it('Returns 404 with non existent manga', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(getUrl(1212121212))
        .send({ mangaService: { titleId: 'aaa' }})
        .csrf()
        .expect(404);
    });
  });

  it('Returns 404 with non existent service', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/admin/manga/1/services/128/create')
        .send({ mangaService: { titleId: 'aaa' }})
        .csrf()
        .expect(404)
        .expect(expectErrorMessage('Foreign key violation'));
    });
  });

  it('Returns 200 with valid data', async () => {
    const mangaId = await createManga();

    const createData = {
      titleId: Date.now().toString(),
      feedUrl: 'test url',
    };

    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(getUrl(mangaId))
        .send({ mangaService: {
          mangaId: 1,
          serviceId: 10,
          lastCheck: new Date(),
          disabled: true,
          latestChapter: 1,
          latestDecimal: 1,
          nextUpdate: new Date(),
          ...createData,
        }})
        .csrf()
        .expect(200);
    });

    const mangaServiceNew = await getMangaService(mangaId);
    expect(mangaServiceNew).toEqual(expect.objectContaining({
      ...createData,
      mangaId,
      serviceId,
    }));
  });
});

