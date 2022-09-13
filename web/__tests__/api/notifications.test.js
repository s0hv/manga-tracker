import request from 'supertest';
import { csrfMissing } from '../../utils/constants';

import initServer from '../initServer';
import stopServer from '../stopServer';
import {
  expectErrorMessage,
  normalUser,
  adminUser,
  withUser,
  configureJestOpenAPI,
} from '../utils';
import { db } from '../../db/helpers';
import {
  createUserNotification,
  getUserNotifications,
} from '../../db/notifications';
import { NotificationTypes } from '../../src/utils/constants';

let httpServer;

beforeAll(async () => {
  ({ httpServer } = await initServer());
  await configureJestOpenAPI();
});

afterAll(async () => {
  await stopServer(httpServer);
});

const notFoundMessage = /No notification found for user with notification id/i;

const truncateNotifications = async () => {
  await db.none`TRUNCATE user_notifications CASCADE`;
};

const createNotifications = async (n = 1, userId = normalUser.userId) => Promise.all(
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

const getNotification = (userId, notificationId) => getUserNotifications(userId)
  .then(notifs => notifs.filter(notif => notif.notificationId === notificationId)[0]);

const mapDbManga = (inserted) => inserted.manga.map(row => ({ mangaId: row.mangaId, serviceId: row.serviceId }));
const mapDbFields = (inserted) => inserted.fields.map(row => ({ name: row.name, value: row.value }));

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

  it('Returns 401 without authentication', async () => {
    await request(httpServer)
      .get(url)
      .expect(401)
      .satisfiesApiSpec();
  });

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
    await createNotifications(n, normalUser.userId);

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

  it('Returns 401 without authentication', async () => {
    await request(httpServer)
      .post(url)
      .csrf()
      .expect(401)
      .satisfiesApiSpec();
  });

  it('Returns 403 without csrf token', async () => {
    await request(httpServer)
      .post(url)
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

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

    const original = await getNotification(adminUser.userId, notificationId);
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

    expect(original).toStrictEqual(await getNotification(adminUser.userId, notificationId));
  });

  it('Returns 200 when creating new valid notification with manga', async () => {
    const body = {
      ...defaultNotificationBody,
    };

    let notificationId;

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

    expect(notificationId).toBeDefined();
    const inserted = await getNotification(normalUser.userId, notificationId);
    expect(inserted).toEqual(expect.objectContaining({
      ...body,
      manga: expect.any(Array),
      fields: expect.any(Array),
    }));

    expect(mapDbManga(inserted)).toIncludeSameMembers(body.manga);
    expect(mapDbFields(inserted)).toIncludeAllMembers(body.fields);
  });

  it('Returns 200 when creating new valid notification without manga', async () => {
    const body = {
      ...defaultNotificationBody,
      manga: null,
      useFollows: true,
    };

    let notificationId;

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

    expect(notificationId).toBeDefined();
    const inserted = await getNotification(normalUser.userId, notificationId);
    expect(inserted).toEqual(expect.objectContaining({
      ...body,
      fields: expect.any(Array),
    }));

    expect(mapDbFields(inserted)).toIncludeAnyMembers(body.fields);
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

    expect(await getNotification(adminUser.userId, notificationId)).toBeObject();
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

    expect(await getNotification(normalUser.userId, notificationId)).toBeUndefined();
  });
});
