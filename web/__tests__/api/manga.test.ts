import request from 'supertest';
import { csrfMissing } from '../../utils/constants';
import { userForbidden, userUnauthorized } from '../constants';

import initServer from '../initServer';
import stopServer from '../stopServer';
import {
  adminUser,
  configureJestOpenAPI,
  expectErrorMessage,
  getErrorMessage,
  normalUser,
  withUser,
} from '../utils';
import { apiRequiresAdminUserPostTests } from './utilities';
import type { DatabaseId, MangaId } from '@/types/dbTypes';
import { createMangaService } from '../dbutils';
import { deleteManga, updateManga } from '@/db/elasticsearch/manga';
import { getMangaPartial } from '@/db/manga';
import { NoResultsError } from '@/db/errors';

let httpServer: any;
const serverReference = {
  httpServer,
};

jest.mock('../../db/elasticsearch/manga', () => {
  const original = jest.requireActual('../../db/elasticsearch/manga'); // Step 2.
  return {
    ...jest.requireActual('../../db/elasticsearch/manga'),
    updateManga: jest.fn().mockImplementation(original.updateManga),
    deleteManga: jest.fn().mockImplementation(original.deleteManga),
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

const getChapterCount = (body: any) => (body && body?.data?.chapters?.length) || 0;

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

describe('POST /api/manga/merge', () => {
  const getUrl = (base: MangaId, toMerge: MangaId, service?: DatabaseId) => {
    return `/api/manga/merge?base=${base}&toMerge=${toMerge}${service ? `&service=${service}` : ''}`;
  };

  apiRequiresAdminUserPostTests(serverReference, getUrl(1, 2));

  const esDeleteMock = jest.fn();
  const esUpdateMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    esDeleteMock.mockResolvedValue(undefined);
    esUpdateMock.mockResolvedValue(undefined);
    (deleteManga as jest.Mock).mockImplementation(esDeleteMock);
    (updateManga as jest.Mock).mockImplementation(esUpdateMock);
  });

  it('Returns 400 with invalid params', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(getUrl('a', 1))
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('a', 'base'));

      await request(httpServer)
        .post(getUrl(1, 'x'))
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('x', 'toMerge'));

      await request(httpServer)
        .post(getUrl(1, 1, 'not int'))
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('not int', 'service'));

      await request(httpServer)
        .post(getUrl(1.1, 2))
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('1.1', 'base'));
    });
  });

  it('Returns 400 with same manga ids', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(getUrl(10, 10))
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('Given ids are equal'));
    });
  });

  it('Returns 400 when manga is missing', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(getUrl(9999, 99999))
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('Not null value was null'));
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
    expect(esDeleteMock).toHaveBeenLastCalledWith(m2.toString());

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
