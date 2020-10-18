import request from 'supertest';
import { insertFollow } from '../../db/follows';
import { mangaIdError, userUnauthorized } from '../constants';

import initServer from '../initServer';
import stopServer from '../stopServer';
import { expectErrorMessage, normalUser, withUser } from '../utils';

let httpServer;

beforeAll(async () => {
  ({ httpServer } = await initServer());
});

afterAll(async () => {
  await stopServer(httpServer);
});

describe('PUT /api/user/follows', () => {
  it('Returns 401 without user authentication', async () => {
    await request(httpServer)
      .put(`/api/user/follows`)
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized));
  });

  it('Returns 400 with invalid manga id', async () => {
    const errorMessage = mangaIdError;

    await withUser(normalUser, async () => {
      await request(httpServer)
        .put(`/api/user/follows?manga_id=-1`)
        .expect(400)
        .expect(expectErrorMessage('-1', 'manga_id', errorMessage));

      await request(httpServer)
        .put(`/api/user/follows?manga_id=Infinity`)
        .expect(400)
        .expect(expectErrorMessage('Infinity', 'manga_id', errorMessage));

      await request(httpServer)
        .put(`/api/user/follows?manga_id=`)
        .expect(400)
        .expect(expectErrorMessage('', 'manga_id', errorMessage));

      await request(httpServer)
        .put(`/api/user/follows?manga_id=2147483648`)
        .expect(400)
        .expect(expectErrorMessage('Number value out of range'));
    });
  });

  it('Returns 400 with invalid service id', async () => {
    const errorMessage = 'Service id must be a positive integer';

    await withUser(normalUser, async () => {
      await request(httpServer)
        .put(`/api/user/follows?manga_id=1&service_id=abc`)
        .expect(400)
        .expect(expectErrorMessage('abc', 'service_id', errorMessage));

      await request(httpServer)
        .put(`/api/user/follows?manga_id=1&service_id=`)
        .expect(400)
        .expect(expectErrorMessage('', 'service_id', errorMessage));

      await request(httpServer)
        .put(`/api/user/follows?manga_id=1&service_id=-1`)
        .expect(400)
        .expect(expectErrorMessage('-1', 'service_id', errorMessage));

      await request(httpServer)
        .put(`/api/user/follows?manga_id=1&service_id=undefined`)
        .expect(400)
        .expect(expectErrorMessage('undefined', 'service_id', errorMessage));
    });
  });

  it('Returns 200 with valid data', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .put(`/api/user/follows?manga_id=1&service_id=1`)
        .expect(200);

      await request(httpServer)
        .put(`/api/user/follows?manga_id=1`)
        .expect(200);
    });
  });
});

describe('DELETE /api/user/follows', () => {
  it('Returns 401 without user authentication', async () => {
    await request(httpServer)
      .delete(`/api/user/follows`)
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized));
  });

  it('Returns 400 with invalid manga id', async () => {
    const errorMessage = mangaIdError;

    await withUser(normalUser, async () => {
      await request(httpServer)
        .delete(`/api/user/follows?manga_id=-1`)
        .expect(400)
        .expect(expectErrorMessage('-1', 'manga_id', errorMessage));

      await request(httpServer)
        .delete(`/api/user/follows?manga_id=Infinity`)
        .expect(400)
        .expect(expectErrorMessage('Infinity', 'manga_id', errorMessage));

      await request(httpServer)
        .delete(`/api/user/follows?manga_id=`)
        .expect(400)
        .expect(expectErrorMessage('', 'manga_id', errorMessage));

      await request(httpServer)
        .delete(`/api/user/follows?manga_id=2147483648`)
        .expect(400)
        .expect(expectErrorMessage('Number value out of range'));
    });
  });

  it('Returns 400 with invalid service id', async () => {
    const errorMessage = 'Service id must be a positive integer';

    await withUser(normalUser, async () => {
      await request(httpServer)
        .delete(`/api/user/follows?manga_id=1&service_id=abc`)
        .expect(400)
        .expect(expectErrorMessage('abc', 'service_id', errorMessage));

      await request(httpServer)
        .delete(`/api/user/follows?manga_id=1&service_id=`)
        .expect(400)
        .expect(expectErrorMessage('', 'service_id', errorMessage));

      await request(httpServer)
        .delete(`/api/user/follows?manga_id=1&service_id=-1`)
        .expect(400)
        .expect(expectErrorMessage('-1', 'service_id', errorMessage));

      await request(httpServer)
        .delete(`/api/user/follows?manga_id=1&service_id=undefined`)
        .expect(400)
        .expect(expectErrorMessage('undefined', 'service_id', errorMessage));
    });
  });

  it('Returns 200 with valid input and 404 on non existent resource', async () => {
    await insertFollow(normalUser.user_id, 1, 1);
    await insertFollow(normalUser.user_id, 1, null);

    await withUser(normalUser, async () => {
      await request(httpServer)
        .delete(`/api/user/follows?manga_id=1&service_id=1`)
        .expect(200);

      // Make sure resource was deleted
      await request(httpServer)
        .delete(`/api/user/follows?manga_id=1&service_id=1`)
        .expect(404);

      await request(httpServer)
        .delete(`/api/user/follows?manga_id=1`)
        .expect(200);

      // Make sure resource was deleted
      await request(httpServer)
        .delete(`/api/user/follows?manga_id=1`)
        .expect(404);
    });
  });
});
