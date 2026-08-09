import { Server } from 'http';

import request from 'supertest';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
} from 'vitest';

import {
  type HttpServerReference,
  apiRequiresAdminUserGetTests,
  apiRequiresAdminUserPostTests,
  apiRequiresAdminUserTests,
  expectISEOnDbError,
} from '@/tests/api/api-test-utilities';
import {
  chapterFailExists,
  createChapterFail,
  deleteChapterFail,
} from '@/tests/dbutils';
import initServer from '@/tests/initServer';
import stopServer from '@/tests/stopServer';
import { adminUser, getErrorMessage, withUser } from '@/tests/utils';
import { db } from '@/db/helpers';
import { TEST_GROUP } from '@/tests/constants';
import {
  ChapterCreateSchema,
  generateSchema,
  setupFaker,
} from '@/tests/schemas';
import type { ChapterFail } from '@/types/db/chapterFail';

let httpServer: Server;
const serverReference: HttpServerReference = {
  httpServer: undefined!,
};

beforeAll(async () => {
  ({ httpServer } = await initServer());
  serverReference.httpServer = httpServer;
});

afterAll(async () => stopServer(httpServer));
setupFaker();

const getEmptyChapterFail = (
  serviceId: number,
  chapterIdentifier: string
): ChapterFail => ({
  serviceId,
  chapterIdentifier,
  errors: 'Test error',
  mangaId: null,
  title: null,
  chapterNumber: null,
  chapterDecimal: null,
  titleId: null,
  mangaTitle: null,
  releaseDate: null,
  group: null,
  timestamp: new Date(),
});


describe('GET /api/admin/chapters-failed', () => {
  const url = '/api/admin/chapters-failed';

  const getUrl = (limit?: string, offset?: string) => {
    const params: Record<string, string> = {};
    if (limit !== undefined) {
      params.limit = limit;
    }
    if (offset !== undefined) {
      params.offset = offset;
    }

    return `${url}?${new URLSearchParams(params).toString()}`;
  };

  apiRequiresAdminUserGetTests(serverReference, url);

  expectISEOnDbError(
    serverReference,
    url,
    {
      user: adminUser,
      method: 'get',
    }
  );

  it.each([
    '10e1',
    '-1',
    'a',
    '',
    '201',
  ])('returns 400 with invalid limit "%s"', async limit => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .get(getUrl(limit))
        .expect(400)
        .expect(res => expect(getErrorMessage(res, 'limit'))
          .toMatchSnapshot());
    });
  });

  it.each([
    '10e1',
    '-1',
    'a',
    '',
  ])('returns 400 with invalid offset "%s"', async offset => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .get(getUrl('10', offset))
        .expect(400)
        .expect(res => expect(getErrorMessage(res, 'offset'))
          .toMatchSnapshot());
    });
  });

  it('returns chapter fails correctly', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .get(url)
        .expect(200)
        .expect(res => {
          expect(res.body).toBeObject();
          expect(res.body.data).toHaveLength(2);


          expect(res.body.data).toEqual([
            expect.objectContaining({
              chapterDecimal: null,
              chapterIdentifier: 'opqrstuvwxyzabcd',
              chapterNumber: null,
              errors: 'Test error 2',
              group: null,
              mangaId: null,
              mangaTitle: null,
              releaseDate: null,
              serviceId: 2,
              timestamp: expect.any(String),
              title: null,
              titleId: null,
            }),

            expect.objectContaining({
              chapterDecimal: 1,
              chapterIdentifier: 'abcdefghijklmn',
              chapterNumber: 1,
              errors: 'Test error',
              group: 'Test group 1',
              mangaId: 1,
              mangaTitle: 'Test Manga',
              releaseDate: '2020-07-08T00:00:00.000Z',
              serviceId: 1,
              timestamp: '2020-07-08T12:00:00.344Z',
              title: 'Test Title',
              titleId: '111',
            }),
          ]);
        });
    });
  });
});

describe('DELETE /api/admin/chapters-failed/:serviceId/:chapterIdentifier', () => {
  const getUrl = (
    serviceId: string | number,
    chapterIdentifier: string
  ) => `/api/admin/chapters-failed/${serviceId}/${chapterIdentifier}`;

  const existingChapterFail = generateSchema(ChapterCreateSchema);

  beforeAll(() => {
    return createChapterFail(getEmptyChapterFail(
      existingChapterFail.serviceId,
      existingChapterFail.chapterIdentifier
    ));
  });

  afterAll(() => deleteChapterFail(
    existingChapterFail.serviceId,
    existingChapterFail.chapterIdentifier
  ));

  apiRequiresAdminUserTests(
    serverReference,
    getUrl(1, '1'),
    { method: 'delete' }
  );

  expectISEOnDbError(
    serverReference,
    getUrl(existingChapterFail.serviceId, existingChapterFail.chapterIdentifier),
    {
      user: adminUser,
      method: 'delete',
    }
  );

  it.each([
    '10e1',
    '-1',
    'adw',
  ])('returns 400 with invalid serviceId "%s"', async serviceId => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .delete(getUrl(serviceId, '1'))
        .csrf()
        .expect(400)
        .expect(res => expect(getErrorMessage(res, 'serviceId', 'params'))
          .toMatchSnapshot());
    });
  });

  it('returns 404 when chapter fail does not exist', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .delete(getUrl(100, '1'))
        .csrf()
        .expect(404);
    });
  });

  it('deletes an existing chapter fail correctly', async () => {
    const {
      serviceId,
      chapterIdentifier,
    } = await createChapterFail();

    onTestFinished(() => {
      return deleteChapterFail(serviceId, chapterIdentifier);
    });

    await withUser(adminUser, async () => {
      await request(httpServer)
        .delete(getUrl(serviceId, chapterIdentifier))
        .csrf()
        .expect(200);
    });

    await expect(chapterFailExists(serviceId, chapterIdentifier)).resolves.toBeFalse();
  });
});

describe('POST /api/admin/chapters-failed/fix', () => {
  const url = '/api/admin/chapters-failed/fix';
  const nonExistentChapterFail = generateSchema(ChapterCreateSchema);
  const existingChapterFail = generateSchema(ChapterCreateSchema);

  beforeAll(() => {
    return createChapterFail(getEmptyChapterFail(
      existingChapterFail.serviceId,
      existingChapterFail.chapterIdentifier
    ));
  });

  afterAll(() => deleteChapterFail(
    existingChapterFail.serviceId,
    existingChapterFail.chapterIdentifier
  ));

  apiRequiresAdminUserPostTests(serverReference, url);
  expectISEOnDbError(
    serverReference,
    url,
    {
      user: adminUser,
      method: 'post',
      body: nonExistentChapterFail,
    }
  );

  it('returns 404 with non-existent chapter fail', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .send(nonExistentChapterFail)
        .csrf()
        .expect(404)
        .expect(res => expect(getErrorMessage(res))
          .toMatchInlineSnapshot(`"Chapter fail not found"`));
    });
  });

  it('returns 404 with non-existent manga', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .send({
          ...existingChapterFail,
          mangaId: 1111111,
        })
        .csrf()
        .expect(404)
        .expect(res => expect(getErrorMessage(res))
          .toMatchInlineSnapshot(`"Manga not found for new chapter"`));
    });
  });

  it('returns 404 with non-existent group', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .send({
          ...existingChapterFail,
          group: {
            groupId: 1111111,
            name: '',
          },
        })
        .csrf()
        .expect(404)
        .expect(res => expect(getErrorMessage(res))
          .toMatchInlineSnapshot(`"Group not found"`));
    });
  });

  it('returns 400 when group name does not match found group', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .send({
          ...existingChapterFail,
          group: {
            groupId: TEST_GROUP.groupId,
            name: `${TEST_GROUP.name} aaa`,
          },
        })
        .csrf()
        .expect(400)
        .expect(res => expect(getErrorMessage(res))
          .toMatchInlineSnapshot(`"Group name in body (Test group 1 aaa) and database (Test group 1) do not match"`));
    });
  });

  it('deletes entry when fix successful', async () => {
    const {
      serviceId,
      chapterIdentifier,
    } = await createChapterFail();

    onTestFinished(async () => {
      await deleteChapterFail(serviceId, chapterIdentifier);
      await db.any`DELETE
                   FROM chapters
                   WHERE service_id = ${serviceId}
                     AND chapter_identifier = ${chapterIdentifier}`;
    });

    const fixedChapter = {
      ...generateSchema(ChapterCreateSchema),
      serviceId,
      chapterIdentifier,
      group: {
        name: TEST_GROUP.name,
        groupId: TEST_GROUP.groupId,
      },
    };

    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .send(fixedChapter)
        .csrf()
        .expect(200);
    });

    // Chapter fail should be deleted now
    await expect(chapterFailExists(serviceId, chapterIdentifier)).resolves.toBeFalse();

    // A new chapter should exist
    const chapterRow = await db.oneOrNone`
        SELECT 1
        FROM chapters
        WHERE service_id = ${serviceId}
          AND chapter_identifier = ${chapterIdentifier}`;

    expect(chapterRow).not.toBeNull();
  });

  it('uses same named group when groupId missing', async () => {
    const {
      serviceId,
      chapterIdentifier,
    } = await createChapterFail();

    onTestFinished(async () => {
      await deleteChapterFail(serviceId, chapterIdentifier);
      await db.any`DELETE
                   FROM chapters
                   WHERE service_id = ${serviceId}
                     AND chapter_identifier = ${chapterIdentifier}`;
    });

    const fixedChapter = {
      ...generateSchema(ChapterCreateSchema),
      serviceId,
      chapterIdentifier,
      group: {
        name: TEST_GROUP.name,
        groupId: null,
      },
    };

    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .send(fixedChapter)
        .csrf()
        .expect(200);
    });

    // Chapter fail should be deleted now
    await expect(chapterFailExists(serviceId, chapterIdentifier)).resolves.toBeFalse();

    // A new chapter should exist
    const chapterRow = await db.oneOrNone`
        SELECT 1
        FROM chapters
        WHERE service_id = ${serviceId}
          AND chapter_identifier = ${chapterIdentifier}
          AND group_id=${TEST_GROUP.groupId};`;

    expect(chapterRow).not.toBeNull();
  });

  it('creates new group when one does not exist with the name', async () => {
    const {
      serviceId,
      chapterIdentifier,
    } = await createChapterFail();

    const groupName = 'non-existent group name';

    onTestFinished(async () => {
      await deleteChapterFail(serviceId, chapterIdentifier);
      await db.none`DELETE
                   FROM chapters
                   WHERE service_id = ${serviceId}
                     AND chapter_identifier = ${chapterIdentifier}`;
      await db.none`DELETE FROM groups WHERE name=${groupName}`;
    });

    const fixedChapter = {
      ...generateSchema(ChapterCreateSchema),
      serviceId,
      chapterIdentifier,
      group: {
        name: groupName,
        groupId: null,
      },
    };

    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .send(fixedChapter)
        .csrf()
        .expect(200);
    });

    // Chapter fail should be deleted now
    await expect(chapterFailExists(serviceId, chapterIdentifier)).resolves.toBeFalse();

    // A new chapter should exist
    const chapterRow = await db.oneOrNone<{ groupId: number }>`
        SELECT group_id
        FROM chapters
        WHERE service_id = ${serviceId}
          AND chapter_identifier = ${chapterIdentifier}`;

    expect(chapterRow).not.toBeNull();
    expect(chapterRow).toHaveProperty('groupId');

    const group = await db.one`
        SELECT name
        FROM groups
        WHERE group_id = ${chapterRow!.groupId}`;

    expect(group).toHaveProperty('name', groupName);
  });
});
