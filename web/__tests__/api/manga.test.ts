import request from 'supertest';
import {
  type Mock,
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { apiRequiresAdminUserPostTests, expectISEOnDbError } from './api-test-utilities';
import { createMangaService } from '../dbutils';
import initServer from '../initServer';
import stopServer from '../stopServer';
import {
  adminUser,
  configureJestOpenAPI,
  expectErrorMessage2,
  getErrorMessage2,
  getErrorMessages,
  withUser,
} from '../utils';
import { deleteManga, updateManga } from '@/db/elasticsearch/manga';
import { NoResultsError } from '@/db/errors';
import { getMangaPartial } from '@/db/manga';
import type { DatabaseId, MangaId } from '@/types/dbTypes';


let httpServer: any;
const serverReference = {
  httpServer,
};

vi.mock('@/db/elasticsearch/manga', async () => {
  const original = await vi.importActual<typeof import('@/db/elasticsearch/manga')>('@/db/elasticsearch/manga'); // Step 2.
  return {
    ...original,
    updateManga: vi.fn().mockImplementation(original.updateManga),
    deleteManga: vi.fn().mockImplementation(original.deleteManga),
  };
});

beforeAll(async () => {
  ({ httpServer } = await initServer());
  serverReference.httpServer = httpServer;
  await configureJestOpenAPI();
});

afterAll(async () => {
  await stopServer(httpServer);
});

describe('GET /api/manga/:mangaId', () => {
  expectISEOnDbError(serverReference, '/api/manga/1');

  it('returns 404 with non existent manga id', async () => {
    await request(httpServer)
      .get(`/api/manga/9999999`)
      .expect(404)
      .satisfiesApiSpec()
      .expect(expectErrorMessage2('Manga not found'));
  });

  it('returns 400 with non positive integers', async () => {
    await request(httpServer)
      .get(`/api/manga/-1`)
      .expect(400)
      .satisfiesApiSpec()
      .expect(expectErrorMessage2('mangaId', 'Too small: expected number to be >=0', 'params'));

    await request(httpServer)
      .get(`/api/manga/abc`)
      .expect(400)
      .satisfiesApiSpec()
      .expect(expectErrorMessage2('mangaId', 'Value must contain only numbers', 'params'));
  });

  it('returns 200 with valid manga id', async () => {
    await request(httpServer)
      .get(`/api/manga/1`)
      .expect(200)
      .satisfiesApiSpec();
  });
});

const getChapterCount = (body: any) => (body && body?.data?.chapters?.length) || 0;

describe('GET /api/manga/:mangaId/chapters', () => {
  const validUrl = '/api/manga/1/chapters';

  expectISEOnDbError(serverReference, validUrl);

  it('returns 400 or 404 with invalid manga id', async () => {
    await request(httpServer)
      .get(`/api/manga/9999999/chapters`)
      // Valid id, but no manga exists for it
      .expect(404);

    await request(httpServer)
      .get(`/api/manga/-1/chapters`)
      .expect(400)
      .expect(res => expect(getErrorMessage2(res, 'mangaId', 'params')).toMatchInlineSnapshot(`"Too small: expected number to be >=0"`));
  });

  it('returns 400 with an invalid limit', async () => {
    await Promise.all([
      request(httpServer)
        .get(`${validUrl}?limit=invalid`)
        .expect('Content-Type', /json/)
        .expect(res => expect(getErrorMessage2(res, 'limit')).toMatchInlineSnapshot(`"Value must contain only numbers"`))
        .expect(400),

      request(httpServer)
        .get(`${validUrl}?limit=NaN`)
        .expect('Content-Type', /json/)
        .expect(res => expect(getErrorMessage2(res, 'limit')).toMatchInlineSnapshot(`"Value must contain only numbers"`))
        .expect(400),

      request(httpServer)
        .get(`${validUrl}?limit=Infinity`)
        .expect('Content-Type', /json/)
        .expect(res => expect(getErrorMessage2(res, 'limit')).toMatchInlineSnapshot(`"Value must contain only numbers"`))
        .expect(400),

      request(httpServer)
        .get(`${validUrl}?limit=-1`)
        .expect('Content-Type', /json/)
        .expect(res => expect(getErrorMessage2(res, 'limit')).toMatchInlineSnapshot(`"Too small: expected number to be >=0"`))
        .expect(400),

      request(httpServer)
        .get(`${validUrl}?limit=300`)
        .expect('Content-Type', /json/)
        .expect(res => expect(getErrorMessage2(res, 'limit')).toMatchInlineSnapshot(`"Too big: expected number to be <=200"`))
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
    await Promise.all([
      request(httpServer)
        .get(`${validUrl}?offset=NaN`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'offset')).toMatchInlineSnapshot(`"Value must contain only numbers"`)),

      request(httpServer)
        .get(`${validUrl}?offset=-1`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'offset')).toMatchInlineSnapshot(`"Too small: expected number to be >=0"`)),

      request(httpServer)
        .get(`${validUrl}?offset=Inf`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'offset')).toMatchInlineSnapshot(`"Value must contain only numbers"`)),

      request(httpServer)
        .get(`${validUrl}?offset=${'1'.repeat(400)}`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'offset')).toMatchInlineSnapshot(`"Value must be finite"`)),
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
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'sortBy')).toMatchInlineSnapshot(`"Invalid option: expected one of "chapter_number"|"group"|"chapter_id"|"release_date""`)),
    ]);
  });

  it('Returns 400 with invalid sort direction', async () => {
    await Promise.all([
      request(httpServer)
        .get(`${validUrl}?sort=test`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'sort')).toMatchInlineSnapshot(`"Invalid option: expected one of "asc"|"desc""`)),
    ]);
  });

  it('Returns chapters with valid sort column and direction', async () => {
    await Promise.all([
      request(httpServer)
        .get(`${validUrl}?sortBy=chapter_number&sort=desc`)
        .satisfiesApiSpec()
        .expect('Content-Type', /json/)
        .expect(200),

      request(httpServer)
        .get(`${validUrl}?sortBy=release_date&sort=asc`)
        .satisfiesApiSpec()
        .expect('Content-Type', /json/)
        .expect(200)
        .expect(res => {
          const chapters = res.body.data.chapters;
          expect(chapters).toStrictEqual([...chapters].sort((c1, c2) => (c1.releaseDate > c2.releaseDate ? -1 : 1)));
        }),
    ]);
  });

  it('Returns 400 with invalid services', async () => {
    const manyInts = '1'.repeat(26).split('');

    await Promise.all([
      request(httpServer)
        .get(`${validUrl}?services=test`)
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'services.0')).toMatchInlineSnapshot(`"Value must contain only numbers"`)),

      request(httpServer)
        .get(`${validUrl}?services=[]`)
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'services.0')).toMatchInlineSnapshot(`"Value must contain only numbers"`)),

      request(httpServer)
        .get(`${validUrl}?services=,`)
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'services.0')).toMatchInlineSnapshot(`"Value must contain only numbers"`)),

      request(httpServer)
        .get(`${validUrl}?services=-1,1`)
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'services.0')).toMatchInlineSnapshot(`"Too small: expected number to be >=0"`)),

      request(httpServer)
        .get(`${validUrl}?services=1.1,2`)
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'services.0')).toMatchInlineSnapshot(`"Value must contain only numbers"`)),

      request(httpServer)
        .get(`${validUrl}?services=1e10`)
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'services.0')).toMatchInlineSnapshot(`"Value must contain only numbers"`)),

      request(httpServer)
        .get(`${validUrl}?services=${manyInts.join(',')}`)
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'services')).toMatchInlineSnapshot(`"Too big: expected array to have <=25 items"`)),
    ]);
  });

  it('Returns chapters with valid services', async () => {
    await Promise.all([
      request(httpServer)
        .get(`${validUrl}?services=100`)
        .satisfiesApiSpec()
        .expect(200)
        .expect(res => {
          expect(res.body.data.chapters).toHaveLength(0);
        }),
      request(httpServer)
        .get(`${validUrl}?services=2`)
        .satisfiesApiSpec()
        .expect(200)
        .expect(res => {
          expect(res.body.data.chapters).toHaveLength(1);
        }),
      request(httpServer)
        .get(`${validUrl}?services=1`)
        .satisfiesApiSpec()
        .expect(200)
        .expect(res => {
          expect(res.body.data.chapters).toHaveLength(9);
        }),
      request(httpServer)
        .get(`${validUrl}?services=1,2`)
        .satisfiesApiSpec()
        .expect(200)
        .expect(res => {
          expect(res.body.data.chapters).toHaveLength(10);
        }),
    ]);
  });
});

describe('POST /api/manga/merge', () => {
  const getUrl = (base: MangaId, toMerge: MangaId, service?: DatabaseId) => {
    return `/api/manga/merge?base=${base}&toMerge=${toMerge}${service ? `&service=${service}` : ''}`;
  };

  apiRequiresAdminUserPostTests(serverReference, getUrl(1, 2));

  const esDeleteMock = vi.fn();
  const esUpdateMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    esDeleteMock.mockResolvedValue(undefined);
    esUpdateMock.mockResolvedValue(undefined);
    (deleteManga as Mock).mockImplementation(esDeleteMock);
    (updateManga as Mock).mockImplementation(esUpdateMock);
  });

  it('Returns 400 with invalid base id', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/manga/merge?base=-1')
        .csrf()
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'base')).toMatchInlineSnapshot(`"Too small: expected number to be >=0"`));

      await request(httpServer)
        .post('/api/manga/merge?base=NaN')
        .csrf()
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'base')).toMatchInlineSnapshot(`"Value must contain only numbers"`));

      await request(httpServer)
        .post('/api/manga/merge?base=abc')
        .csrf()
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'base')).toMatchInlineSnapshot(`"Value must contain only numbers"`));
    });
  });

  it('Returns 400 with invalid toMerge id', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/manga/merge?toMerge=-1')
        .csrf()
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'toMerge')).toMatchInlineSnapshot(`"Too small: expected number to be >=0"`));

      await request(httpServer)
        .post('/api/manga/merge?toMerge=NaN')
        .csrf()
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'toMerge')).toMatchInlineSnapshot(`"Value must contain only numbers"`));

      await request(httpServer)
        .post('/api/manga/merge?toMerge=abc')
        .csrf()
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'toMerge')).toMatchInlineSnapshot(`"Value must contain only numbers"`));
    });
  });

  it('Returns 400 when base equals toMerge', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/manga/merge?toMerge=5&base=5')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage2('Given ids are equal'));
    });
  });

  it('Returns 400 with invalid service id', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post('/api/manga/merge?toMerge=1&base=2&service=-1')
        .csrf()
        .expect(400)
        .expect(res => expect(getErrorMessages(res)).toMatchInlineSnapshot(`
          {
            "query.service": [
              "Too small: expected number to be >=0",
            ],
          }
        `));

      await request(httpServer)
        .post('/api/manga/merge?toMerge=1&base=2&service=abc')
        .csrf()
        .expect(400)
        .expect(res => expect(getErrorMessages(res)).toMatchInlineSnapshot(`
          {
            "query.service": [
              "Value must contain only numbers",
            ],
          }
        `));
    });
  });

  it('Returns 400 with invalid params', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(getUrl('a', 1))
        .csrf()
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'base')).toMatchInlineSnapshot(`"Value must contain only numbers"`));

      await request(httpServer)
        .post(getUrl(1, 'x'))
        .csrf()
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'toMerge')).toMatchInlineSnapshot(`"Value must contain only numbers"`));

      await request(httpServer)
        .post(getUrl(1, 1, 'not int'))
        .csrf()
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'service')).toMatchInlineSnapshot(`"Value must contain only numbers"`));

      await request(httpServer)
        .post(getUrl(1.1, 2))
        .csrf()
        .expect(400)
        .expect(res => expect(getErrorMessage2(res, 'base')).toMatchInlineSnapshot(`"Value must contain only numbers"`));
    });
  });

  it('Returns 400 with same manga ids', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(getUrl(10, 10))
        .csrf()
        .expect(400)
        .expect(expectErrorMessage2('Given ids are equal'));
    });
  });

  it('Returns 400 when manga is missing', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(getUrl(9999, 99999))
        .csrf()
        .expect(400)
        .expect(expectErrorMessage2('Not null value was null'));
    });
  });

  it('Returns 200 when manga is found', async () => {
    const m1 = await createMangaService(1);
    const m2 = await createMangaService(2);

    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(getUrl(m1, m2))
        .csrf()
        .expect(200)
        .expect(res => expect(res.body).toEqual({ aliasCount: 0, chapterCount: 0 }));
    });

    expect(esUpdateMock).toHaveBeenCalledOnce();
    expect(esUpdateMock).toHaveBeenLastCalledWith(m1, expect.objectContaining({
      mangaId: m1,
    }));

    expect(esDeleteMock).toHaveBeenCalledOnce();
    expect(esDeleteMock).toHaveBeenLastCalledWith(m2);

    // Make sure the other manga is gone from the db
    await expect(getMangaPartial(m2))
      .rejects
      .toThrow(NoResultsError);
  });

  it('Returns 200 when manga is found with specific service', async () => {
    const m1 = await createMangaService(1);
    const serviceId = 2;
    const m2 = await createMangaService(serviceId);
    await createMangaService(3, m2);

    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(getUrl(m1, m2, serviceId))
        .csrf()
        .expect(200)
        .expect(res => expect(res.body).toEqual({ aliasCount: 0, chapterCount: 0 }));
    });

    expect(esDeleteMock).not.toHaveBeenCalled();

    let loops = 0;
    const waitForUpdates = async (): Promise<void> => {
      if (esUpdateMock.mock.calls.length >= 2) return;

      loops++;
      // Shouldn't take too long so just quit early and save a few seconds
      if (loops > 4) return;

      await new Promise(resolve => setTimeout(resolve, 50));
      return waitForUpdates();
    };

    await waitForUpdates();

    expect(esUpdateMock).toHaveBeenCalledTimes(2);
    expect(esUpdateMock).toHaveBeenCalledWith(m2, expect.objectContaining({
      mangaId: m2,
    }));
    expect(esUpdateMock).toHaveBeenCalledWith(m1, expect.objectContaining({
      mangaId: m1,
    }));

    // Make sure the other manga stays in the manga
    expect(await getMangaPartial(m2)).toBeDefined();
  });
});
