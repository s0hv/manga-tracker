import request, { type Agent } from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import initServer from '../initServer';
import stopServer from '../stopServer';
import {
  adminUser,
  expectErrorMessage,
  getCookie,
  login,
  normalUser,
  oauthUser,
  withUser,
} from '../utils';
import { apiRequiresUserPostTests } from './api-test-utilities';
import {
  expectAuthTokenRegenerated,
  expectSessionRegenerated,
  spyOnDb,
} from '@/tests/dbutils';
import { insertFollow } from '@/db/follows';
import { db } from '@/db/helpers';
import { createUser } from '@/db/user';
import { csrfMissing, serverCookieNames } from '@/serverUtils/constants';
import { redis } from '@/serverUtils/ratelimits';


import {
  type TestUser,
  authTokenCookieRegex,
  mangaIdError,
  sessionCookieRegex,
  userUnauthorized,
} from '../constants';

let httpServer: any;
const serverReference = {
  httpServer,
};


beforeAll(async () => {
  ({ httpServer } = await initServer());
  serverReference.httpServer = httpServer;
});

afterAll(async () => {
  await stopServer(httpServer);
});

beforeEach(async () => {
  await redis.flushall();
});

describe('PUT /api/user/follows', () => {
  it('Returns 401 without user authentication', async () => {
    await request(httpServer)
      .put('/api/user/follows')
      .csrf()
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized));
  });

  it('Returns 403 without CSRF token', async () => {
    await request(httpServer)
      .put('/api/user/follows')
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('Returns 400 with invalid manga id', async () => {
    const errorMessage = mangaIdError;

    await withUser(normalUser, async () => {
      await request(httpServer)
        .put('/api/user/follows?mangaId=-1')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('-1', 'mangaId', errorMessage));

      await request(httpServer)
        .put('/api/user/follows?mangaId=Infinity')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('Infinity', 'mangaId', errorMessage));

      await request(httpServer)
        .put('/api/user/follows?mangaId=')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('', 'mangaId', errorMessage));

      await request(httpServer)
        .put('/api/user/follows?mangaId=2147483648')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('Number value out of range'));
    });
  });

  it('Returns 400 with invalid service id', async () => {
    const errorMessage = 'Service id must be a positive integer';

    await withUser(normalUser, async () => {
      await request(httpServer)
        .put('/api/user/follows?mangaId=1&serviceId=abc')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('abc', 'serviceId', errorMessage));

      await request(httpServer)
        .put('/api/user/follows?mangaId=1&serviceId=')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('', 'serviceId', errorMessage));

      await request(httpServer)
        .put('/api/user/follows?mangaId=1&serviceId=-1')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('-1', 'serviceId', errorMessage));

      await request(httpServer)
        .put('/api/user/follows?mangaId=1&serviceId=undefined')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('undefined', 'serviceId', errorMessage));
    });
  });

  it('Returns 200 with valid data', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .put('/api/user/follows?mangaId=1&serviceId=1')
        .csrf()
        .expect(200);

      await request(httpServer)
        .put(`/api/user/follows?mangaId=1`)
        .csrf()
        .expect(200);
    });
  });
});

describe('DELETE /api/user/follows', () => {
  it('Returns 403 without CSRF token', async () => {
    await request(httpServer)
      .delete('/api/user/follows')
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('Returns 401 without user authentication', async () => {
    await request(httpServer)
      .delete('/api/user/follows')
      .csrf()
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized));
  });

  it('Returns 400 with invalid manga id', async () => {
    const errorMessage = mangaIdError;

    await withUser(normalUser, async () => {
      await request(httpServer)
        .delete('/api/user/follows?mangaId=-1')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('-1', 'mangaId', errorMessage));

      await request(httpServer)
        .delete('/api/user/follows?mangaId=Infinity')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('Infinity', 'mangaId', errorMessage));

      await request(httpServer)
        .delete('/api/user/follows?mangaId=')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('', 'mangaId', errorMessage));

      await request(httpServer)
        .delete('/api/user/follows?mangaId=2147483648')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('Number value out of range'));
    });
  });

  it('Returns 400 with invalid service id', async () => {
    const errorMessage = 'Service id must be a positive integer';

    await withUser(normalUser, async () => {
      await request(httpServer)
        .delete('/api/user/follows?mangaId=1&serviceId=abc')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('abc', 'serviceId', errorMessage));

      await request(httpServer)
        .delete('/api/user/follows?mangaId=1&serviceId=')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('', 'serviceId', errorMessage));

      await request(httpServer)
        .delete('/api/user/follows?mangaId=1&serviceId=-1')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('-1', 'serviceId', errorMessage));

      await request(httpServer)
        .delete('/api/user/follows?mangaId=1&serviceId=undefined')
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('undefined', 'serviceId', errorMessage));
    });
  });

  it('Returns 200 with valid input and 404 on non existent resource', async () => {
    await insertFollow(normalUser.userId, 1, 1);
    await insertFollow(normalUser.userId, 1, null);

    await withUser(normalUser, async () => {
      await request(httpServer)
        .delete(`/api/user/follows?mangaId=1&serviceId=1`)
        .csrf()
        .expect(200);

      // Make sure resource was deleted
      await request(httpServer)
        .delete(`/api/user/follows?mangaId=1&serviceId=1`)
        .csrf()
        .expect(404);

      await request(httpServer)
        .delete(`/api/user/follows?mangaId=1`)
        .csrf()
        .expect(200);

      // Make sure resource was deleted
      await request(httpServer)
        .delete(`/api/user/follows?mangaId=1`)
        .csrf()
        .expect(404);
    });
  });
});

describe('POST /api/user/profile', () => {
  it('Returns 403 without CSRF token', async () => {
    await request(httpServer)
      .post('/api/profile')
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('returns 401 without login', async () => {
    await request(httpServer)
      .post('/api/profile')
      .csrf()
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized));
  });

  it('returns 400 with invalid username', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .post('/api/profile')
        .csrf()
        .send({ username: 'a'.repeat(101) })
        .expect(400)
        .expect(expectErrorMessage('a'.repeat(101), 'username', /Max username length is \d+/));

      await request(httpServer)
        .post('/api/profile')
        .csrf()
        .send({ username: [1, 2]})
        .expect(400)
        .expect(expectErrorMessage([1, 2], 'username'));

      await request(httpServer)
        .post('/api/profile')
        .csrf()
        .send({ username: null })
        .expect(400)
        .expect(expectErrorMessage(null, 'username'));
    });
  });

  it('returns 400 when trying to modify email', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .post('/api/profile')
        .csrf()
        .send({ email: 'test@abc', password: 'notRealPassword' })
        .expect(400)
        .expect(expectErrorMessage('Nothing to change'));
    });
  });

  it('returns 400 with too long or too short password', async () => {
    await withUser(normalUser, async () => {
      const spy = spyOnDb();
      const tooLong = 'a'.repeat(73);
      const tooShort = 'abc1234';

      await request(httpServer)
        .post('/api/profile')
        .csrf()
        .send({
          newPassword: tooLong,
          repeatPassword: tooLong,
          password: 'notRealPassword',
        })
        .expect(400)
        .expect(expectErrorMessage(tooLong, 'newPassword', 'Password must be between 8 and 72 characters long'));

      await request(httpServer)
        .post('/api/profile')
        .csrf()
        .send({
          newPassword: tooShort,
          repeatPassword: tooShort,
          password: 'notRealPassword',
        })
        .expect(400)
        .expect(expectErrorMessage(tooShort, 'newPassword', 'Password must be between 8 and 72 characters long'));

      expect(spy).not.toHaveBeenCalled();
    });
  });

  it('returns 400 if given passwords do not match', async () => {
    await withUser(normalUser, async () => {
      const spy = spyOnDb();
      const newPassword = 'abcd1234';
      const repeatPassword = 'does not match';

      await request(httpServer)
        .post('/api/profile')
        .csrf()
        .send({
          newPassword,
          repeatPassword,
          password: 'notRealPassword',
        })
        .expect(400)
        .expect(expectErrorMessage(newPassword, 'newPassword', /did not match/));

      expect(spy).not.toHaveBeenCalled();
    });
  });

  it('returns 401 when editing email or changing password without giving old password', async () => {
    await withUser(normalUser, async () => {
      const spy = spyOnDb();

      await request(httpServer)
        .post('/api/profile')
        .csrf()
        .send({ newPassword: 'newPass123' })
        .expect(401)
        .expect(expectErrorMessage('Password required for modifying newPassword'));

      expect(spy).not.toHaveBeenCalled();
    });
  });

  it('returns 401 when editing all values without password', async () => {
    await withUser(normalUser, async () => {
      const spy = spyOnDb();

      await request(httpServer)
        .post('/api/profile')
        .csrf()
        .send({
          email: 'test@email.com',
          username: 'test',
          repeatPassword: 'abcdefg123',
          newPassword: 'abcdefg123',
        })
        .expect(401)
        .expect(expectErrorMessage(/Password required for modifying/));

      expect(spy).not.toHaveBeenCalled();
    });
  });

  it('returns 403 when trying to change password as an oauth user', async () => {
    const agent = await login(httpServer, oauthUser);
    const spy = spyOnDb();

    await agent
      .post('/api/profile')
      .csrf()
      .send({
        newPassword: 'test',
        repeatPassword: 'test',
        password: oauthUser.password,
      })
      .expect(403)
      .expect(expectErrorMessage('This action is only available if your account is a traditional email + password account.'));

    expect(spy).not.toHaveBeenCalled();
  });

  it('returns 400 when trying to change email and password with normal user', async () => {
    const agent = await login(httpServer, normalUser);
    await agent
      .post('/api/profile')
      .csrf()
      .send({ email: adminUser.email, password: normalUser.password })
      .expect(400)
      .expect(expectErrorMessage('Nothing to change'));
  });

  async function checkAndResetPassword(agent: Agent, newPassword: string, user: TestUser) {
    // Make sure the password doesn't work anymore
    await agent
      .post('/api/profile')
      .csrf()
      .send({
        newPassword: user.password,
        repeatPassword: user.password,
        password: user.password,
      })
      .expect(401);

    // Change password back
    await agent
      .post('/api/profile')
      .csrf()
      .send({
        newPassword: user.password,
        repeatPassword: user.password,
        password: newPassword,
      })
      .expect(200);
  }

  it('returns 200 when changing password with remember me', async () => {
    const agent = await login(httpServer, normalUser, true);

    const oldAuth = getCookie(agent, serverCookieNames.authToken)!;
    const oldSess = getCookie(agent, serverCookieNames.session)!;
    expect(oldAuth).toBeDefined();
    expect(oldSess).toBeDefined();

    const newPassword = 'testPassword12345';

    await agent
      .post('/api/profile')
      .csrf()
      .send({
        newPassword: newPassword,
        repeatPassword: newPassword,
        password: normalUser.password,
      })
      .expect(200)
      .expect('set-cookie', authTokenCookieRegex)
      .expect('set-cookie', sessionCookieRegex);

    const sess = await expectSessionRegenerated(agent, oldSess.value);
    const auth = await expectAuthTokenRegenerated(agent, oldAuth.value);

    await checkAndResetPassword(agent, newPassword, normalUser);
    await expectSessionRegenerated(agent, sess.value);
    await expectAuthTokenRegenerated(agent, auth.value);
  });

  it('returns 200 when changing password  without remember me', async () => {
    const agent = await login(httpServer, normalUser);

    const oldSess = getCookie(agent, serverCookieNames.session)!;
    expect(oldSess).toBeDefined();

    const newPassword = 'testPassword12345';

    await agent
      .post('/api/profile')
      .csrf()
      .send({
        newPassword: newPassword,
        repeatPassword: newPassword,
        password: normalUser.password,
      })
      .expect(200);

    const sess = await expectSessionRegenerated(agent, oldSess.value)!;
    await checkAndResetPassword(agent, newPassword, normalUser);
    await expectSessionRegenerated(agent, sess.value);
  });

  it('returns 200 when changing username', async () => {
    const agent = await login(httpServer, normalUser);

    const sess = getCookie(agent, serverCookieNames.session);

    await agent
      .post('/api/profile')
      .csrf()
      .send({ username: 'test ci edited' })
      .expect(200);

    expect(sess?.value).toEqual(getCookie(agent, serverCookieNames.session)?.value);
  });

  it('returns 200 when modifying all values at the same time', async () => {
    const agent = await login(httpServer, normalUser);

    const newPassword = 'testPassword12345';

    await agent
      .post('/api/profile')
      .csrf()
      .send({
        newPassword: newPassword,
        repeatPassword: newPassword,
        password: normalUser.password,
        username: normalUser.username,
      })
      .expect(200);

    await checkAndResetPassword(agent, newPassword, normalUser);
  });
});

describe('POST /api/user/delete', () => {
  const url = '/api/user/delete';
  apiRequiresUserPostTests(serverReference, url);

  it('Deletes the user', async () => {
    const deleteTestUser: TestUser = {
      ...normalUser,
      email: 'delete-user-test@email.com',
    };
    // First, delete the user if it exists
    await db.none`DELETE FROM users WHERE email = ${deleteTestUser.email}`;
    const createdUser = await createUser(deleteTestUser);
    const agent = await login(httpServer, deleteTestUser);

    await agent.post(url)
      .csrf()
      .expect(200);

    await expect(db.one`SELECT * FROM users WHERE user_id = ${createdUser.userId}`)
      .rejects.toThrowErrorMatchingInlineSnapshot(`[Error: No rows found]`);

    await expect(db.many`SELECT * FROM sessions WHERE user_id = ${createdUser.userId}`)
      .rejects.toThrowErrorMatchingInlineSnapshot(`[Error: No rows found]`);

    await expect(login(httpServer, deleteTestUser)).rejects
      .toThrowErrorMatchingInlineSnapshot(`[Error: expected 302 "Found", got 401 "Unauthorized"]`);
  });
});

describe('POST /api/user/dataRequest', () => {
  const url = '/api/user/dataRequest';
  apiRequiresUserPostTests(serverReference, url);

  it('Returns user data', async () => {
    const agent = await login(httpServer, oauthUser);

    let body: any;
    await agent.post(url)
      .csrf()
      .expect(200)
      .expect(res => expect(res.body).toBeObject())
      .expect(res => { body = res.body });

    expect(body).toEqual(expect.objectContaining({
      notifications: expect.any(Array),

      user: {
        userId: oauthUser.userId,
        username: oauthUser.username,
        email: oauthUser.email,
        userUuid: oauthUser.userUuid,
        joinedAt: expect.any(String),
        admin: oauthUser.admin,
        theme: oauthUser.theme,
        lastActive: expect.any(String),
      },

      accounts: expect.arrayContaining([
        {
          provider: expect.any(String),
          providerAccountId: expect.any(String),
          userId: oauthUser.userId,
        },
      ]),

      follows: expect.any(Array),

      sessions: expect.arrayContaining([
        {
          expiresAt: expect.any(String),
          data: expect.any(Object),
        },
      ]),
    }));
  });
});
