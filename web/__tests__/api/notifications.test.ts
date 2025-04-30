import request from 'supertest';
import {
  describe,
  expect,
  beforeAll,
  afterAll,
  it,
} from 'vitest';

import { csrfMissing } from '@/serverUtils/constants';
import initServer from '../initServer';
import stopServer from '../stopServer';
import {
  adminUser,
  configureJestOpenAPI,
  expectErrorMessage,
  normalUser,
  silenceConsole,
  withUser,
} from '../utils';
import { db } from '@/db/helpers';
import {
  createUserNotification,
  type DbNotificationData,
  getUserNotifications,
  type UpsertNotificationOverride,
  upsertNotificationOverride,
} from '@/db/notifications';
import { NotificationTypes } from '@/webUtils/constants';
import { apiRequiresUserGetTests, apiRequiresUserPostTests } from './utilities';
import { invalidValue } from '../constants';

let httpServer: any;
const serverReference = {
  httpServer,
};

beforeAll(async () => {
  ({ httpServer } = await initServer());
  serverReference.httpServer = httpServer;
  await configureJestOpenAPI();
});

afterAll(async () => {
  await stopServer(httpServer);
});

const notFoundMessage = /No notification found for user with notification id/i;

const truncateNotifications = async () => {
  await silenceConsole(db.none`TRUNCATE user_notifications CASCADE`);
};

const createNotifications = async (n = 1, userId = normalUser.userId): Promise<number[]> => Promise.all(
  new Array(n).fill(1).map(() => createUserNotification({
    notificationType: 1,
    userId,
    useFollows: true,
    disabled: false,
    groupByManga: false,
    destination: 'test',
    name: 'test',
    manga: null,
    fields: [
      { name: 'embed_title', value: 'a' },
      { name: 'embed_content', value: 'b' },
    ],
  }))
);

const createOverride = (notificationId: number, mangaId: number, userId = normalUser.userId) => upsertNotificationOverride({
  notificationId,
  userId,
  overrideId: mangaId,
  fields: [
    { name: 'embed_title', value: 'overridden' },
    { name: 'url', value: 'new value' },
  ],
});

const mapDbManga = (inserted: DbNotificationData) => inserted?.manga?.map(row => ({ mangaId: row.mangaId, serviceId: row.serviceId }));
const mapDbFields = (inserted: DbNotificationData) => inserted.fields.map(row => ({ name: row.name, value: row.value }));

const defaultNotificationBody = {
  notificationType: NotificationTypes.DiscordWebhook,
  useFollows: false,
  disabled: false,
  groupByManga: false,
  destination: 'test',
  name: 'test',
  manga: [
    { mangaId: 1, serviceId: 1 },
    { mangaId: 1, serviceId: 2 },
    { mangaId: 2, serviceId: null },
  ],
  fields: [
    { name: 'embed_title', value: 'a' },
    { name: 'embed_content', value: 'b' },
  ],
};

describe('GET /api/notifications', () => {
  const url = '/api/notifications';

  apiRequiresUserGetTests(serverReference, url, true);

  it('Returns 200 with authentication', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .get(url)
        .expect(200)
        .satisfiesApiSpec()
        .expect(res => {
          expect(res.body.data).toBeArray();
        });
    });
  });

  it('Returns the list of users notifications', async () => {
    await truncateNotifications();
    const n = 3;
    const notificationIds = await createNotifications(n, normalUser.userId);
    await createOverride(notificationIds[0], 1);

    await withUser(normalUser, async () => {
      await request(httpServer)
        .get(url)
        .expect(200)
        .satisfiesApiSpec()
        .expect(res => {
          expect(res.body.data).toHaveLength(n);
        });
    });
  });
});

describe('POST /api/notifications', () => {
  const url = '/api/notifications';

  apiRequiresUserPostTests(serverReference, url, true);

  it('Returns 400 without body', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .expect(400)
        .satisfiesApiSpec();
    });
  });

  it('Returns 400 when useFollows is false and no manga given', async () => {
    const body = {
      ...defaultNotificationBody,
      manga: null,
      useFollows: false,
    };

    await withUser(normalUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send(body)
        .expect(400)
        .satisfiesApiSpec()
        .expect(expectErrorMessage(null, 'manga', /At least one manga is required when useFollows is false/i));
    });
  });

  it('Returns 400 when not all required fields are given', async () => {
    const body = {
      ...defaultNotificationBody,
      fields: [defaultNotificationBody.fields[0]],
    };

    await withUser(normalUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send(body)
        .expect(400)
        .satisfiesApiSpec()
        .expect(expectErrorMessage(/Not all required fields given/i));
    });
  });

  it('Returns 404 when updating a non existent notification', async () => {
    const body = {
      ...defaultNotificationBody,
      notificationId: 1,
    };

    await truncateNotifications();

    await withUser(normalUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send(body)
        .expect(404)
        .satisfiesApiSpec()
        .expect(expectErrorMessage(notFoundMessage));
    });
  });

  it('Returns 404 when updating another users notification', async () => {
    const notificationId = (await createNotifications(1, adminUser.userId))[0];
    expect(notificationId).toBeInteger();

    const original = await getUserNotifications(adminUser.userId, notificationId);
    expect(original).toBeObject();

    const body = {
      ...defaultNotificationBody,
      notificationId,
      name: 'modified',
      disabled: true,
    };

    await withUser(normalUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send(body)
        .expect(404)
        .satisfiesApiSpec()
        .expect(expectErrorMessage(notFoundMessage));
    });

    expect(original).toStrictEqual(await getUserNotifications(adminUser.userId, notificationId));
  });

  it('Returns 200 when creating new valid notification with manga', async () => {
    const body = {
      ...defaultNotificationBody,
    };

    let inserted: DbNotificationData;

    await withUser(normalUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send(body)
        .expect(200)
        .satisfiesApiSpec()
        .expect(res => {
          inserted = res.body.data;
        });
    });

    inserted = inserted!;
    expect(inserted).toBeDefined();
    const insertedFromDb = await getUserNotifications(normalUser.userId, inserted.notificationId);
    expect(inserted).toEqual(expect.objectContaining({
      ...body,
      manga: expect.any(Array),
      fields: expect.any(Array),
    }));
    expect(inserted).toEqual(insertedFromDb);

    expect(mapDbManga(inserted)).toIncludeSameMembers(body.manga);
    expect(mapDbFields(inserted)).toIncludeAllMembers(body.fields);
  });

  it('Returns 200 when creating new valid notification without manga', async () => {
    const body = {
      ...defaultNotificationBody,
      manga: null,
      useFollows: true,
    };

    let notificationId: number;

    await withUser(normalUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send(body)
        .expect(200)
        .satisfiesApiSpec()
        .expect(res => {
          notificationId = res.body.data.notificationId;
        });
    });

    expect(notificationId!).toBeDefined();
    const inserted = await getUserNotifications(normalUser.userId, notificationId!);
    expect(inserted).toEqual(expect.objectContaining({
      ...body,
      fields: expect.any(Array),
    }));

    expect(mapDbFields(inserted)).toIncludeAnyMembers(body.fields);
  });

  it('Returns 200 when updating existing notification', async () => {
    const notificationId = (await createNotifications(1))[0];

    const body = {
      ...defaultNotificationBody,
      manga: null,
      useFollows: true,
      notificationId,
    };

    await withUser(normalUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send(body)
        .expect(200)
        .satisfiesApiSpec()
        .expect(res => expect(res.body.data.notificationId).toBe(notificationId));
    });
  });
});

describe('DELETE /api/notifications', () => {
  const url = '/api/notifications/';
  const defaultUrl = '/api/notifications/1';

  it('Returns 401 without authentication', async () => {
    await request(httpServer)
      .delete(defaultUrl)
      .csrf()
      .expect(401)
      .satisfiesApiSpec();
  });

  it('Returns 403 without csrf token', async () => {
    await request(httpServer)
      .delete(defaultUrl)
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('Returns 404 when notification not found', async () => {
    await truncateNotifications();
    await withUser(normalUser, async () => {
      await request(httpServer)
        .delete(defaultUrl)
        .csrf()
        .expect(404)
        .satisfiesApiSpec()
        .expect(expectErrorMessage(notFoundMessage));
    });
  });

  it('Returns 404 when trying to delete notification of another user', async () => {
    const notificationId = (await createNotifications(1, adminUser.userId))[0];
    expect(notificationId).toBeInteger();

    await withUser(normalUser, async () => {
      await request(httpServer)
        .delete(url + notificationId.toString())
        .csrf()
        .expect(404)
        .satisfiesApiSpec()
        .expect(expectErrorMessage(notFoundMessage));
    });

    expect(await getUserNotifications(adminUser.userId, notificationId)).toBeObject();
  });

  it('Returns 200 when successfully deleted own notification', async () => {
    const notificationId = (await createNotifications(1, normalUser.userId))[0];
    expect(notificationId).toBeInteger();

    await withUser(normalUser, async () => {
      await request(httpServer)
        .delete(url + notificationId.toString())
        .csrf()
        .expect(200)
        .satisfiesApiSpec();
    });

    expect(await getUserNotifications(normalUser.userId, notificationId)).toBeUndefined();
  });
});

describe('POST /api/notifications/override', () => {
  const url = '/api/notifications/override';
  const defaultBody: Omit<UpsertNotificationOverride, 'userId'> = {
    notificationId: 1,
    overrideId: 1,
    fields: [
      { value: 'test', name: 'url' },
    ],
  };

  apiRequiresUserPostTests(serverReference, url, true);

  it('Returns 404 when notification not found', async () => {
    await truncateNotifications();
    await withUser(normalUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send(defaultBody)
        .expect(404)
        .satisfiesApiSpec()
        .expect(expectErrorMessage(notFoundMessage));
    });
  });

  it('Returns 404 when trying to update notification of another user', async () => {
    const notificationId = (await createNotifications(1, adminUser.userId))[0];
    expect(notificationId).toBeInteger();

    await withUser(normalUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          ...defaultBody,
          notificationId,
        })
        .expect(404)
        .satisfiesApiSpec()
        .expect(expectErrorMessage(notFoundMessage));
    });

    expect((await getUserNotifications(adminUser.userId, notificationId)).overrides).toBeEmptyObject();
  });

  it('Returns 400 with invalid body', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .expect(400)
        .satisfiesApiSpec()
        .expect(expectErrorMessage(undefined, 'notificationId', invalidValue))
        .expect(expectErrorMessage(undefined, 'overrideId', invalidValue))
        .expect(expectErrorMessage(undefined, 'fields', invalidValue));

      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          notificationId: null,
          overrideId: null,
          fields: null,
        })
        .expect(400)
        .satisfiesApiSpec()
        .expect(expectErrorMessage(null, 'notificationId', invalidValue))
        .expect(expectErrorMessage(null, 'overrideId', invalidValue))
        .expect(expectErrorMessage(null, 'fields', invalidValue));

      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          notificationId: '1e10',
          overrideId: '1e10',
          fields: [],
        })
        .expect(400)
        .satisfiesApiSpec()
        .expect(expectErrorMessage('1e10', 'notificationId', invalidValue))
        .expect(expectErrorMessage('1e10', 'overrideId', invalidValue));

      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          notificationId: '1',
          overrideId: 1,
          fields: [{}],
        })
        .expect(400)
        .satisfiesApiSpec()
        .expect(expectErrorMessage(undefined, 'fields[0].value', invalidValue))
        .expect(expectErrorMessage(undefined, 'fields[0].name', invalidValue));

      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          notificationId: '1',
          overrideId: 1,
          fields: [{ name: null, value: '' }],
        })
        .expect(400)
        .satisfiesApiSpec()
        .expect(expectErrorMessage(null, 'fields[0].name', invalidValue));
    });
  });

  it('Returns 200 when successfully created a new override', async () => {
    const notificationId = (await createNotifications(1, normalUser.userId))[0];
    expect(notificationId).toBeInteger();

    await withUser(normalUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          ...defaultBody,
          notificationId,
        })
        .expect(200)
        .satisfiesApiSpec();
    });

    const notif = await getUserNotifications(normalUser.userId, notificationId);
    expect(notif.overrides).toHaveProperty(defaultBody.overrideId.toString());
    expect(notif.overrides[defaultBody.overrideId]).toBeArrayOfSize(1);
    expect(notif.overrides[defaultBody.overrideId][0]).toEqual(expect.objectContaining(defaultBody.fields[0]));
  });

  it('Deletes override when fields are empty', async () => {
    const notificationId = (await createNotifications(1, normalUser.userId))[0];
    expect(notificationId).toBeInteger();
    const overrideId = 1;
    await createOverride(notificationId, overrideId, normalUser.userId);

    await withUser(normalUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          notificationId,
          overrideId,
          fields: [],
        })
        .expect(200)
        .satisfiesApiSpec();
    });

    const notif = await getUserNotifications(normalUser.userId, notificationId);
    expect(notif.overrides).toBeEmptyObject();
  });
});

describe('GET /api/notifications/notificationFollows', () => {
  const url = '/api/notifications/notificationFollows';

  apiRequiresUserGetTests(serverReference, url, true);

  it('Returns 200 when authenticated', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .get(url)
        .expect(200)
        .satisfiesApiSpec()
        .expect(res => expect(res.body.data).not.toBeEmpty());
    });
  });
});
