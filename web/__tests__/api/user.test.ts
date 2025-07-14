import request, { type Agent } from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import initServer from '../initServer';
import stopServer from '../stopServer';
import {
  adminUser,
  expectErrorMessage,
  getCookie,
  getSessionToken,
  login,
  normalUser,
  oauthUser,
  withUser,
} from '../utils';
import { apiRequiresUserPostTests } from './api-test-utilities';
import { insertFollow } from '@/db/follows';
import { db } from '@/db/helpers';
import { csrfMissing } from '@/serverUtils/constants';
import { redis } from '@/serverUtils/ratelimits';


import { type TestUser, mangaIdError, userUnauthorized } from '../constants';

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
    });
  });

  it('returns 400 if given passwords do not match', async () => {
    await withUser(normalUser, async () => {
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
    });
  });

  it('returns 401 when editing email or changing password without giving old password', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .post('/api/profile')
        .csrf()
        .send({ newPassword: 'newPass123' })
        .expect(401)
        .expect(expectErrorMessage('Password required for modifying newPassword'));
    });
  });

  it('returns 401 when editing all values without password', async () => {
    await withUser(normalUser, async () => {
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
    });
  });

  it('returns 403 when trying to change email to an existing email', async () => {
    const agent = await login(httpServer, oauthUser);
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
  });

  it('returns 400 when trying to change password with oauth user', async () => {
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

  it('returns 200 when changing password', async () => {
    const agent = await login(httpServer, normalUser);

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

    await checkAndResetPassword(agent, newPassword, normalUser);
  });

  it('returns 200 when changing username', async () => {
    const agent = await login(httpServer, normalUser);

    const sess = getCookie(agent, 'sess');

    await agent
      .post('/api/profile')
      .csrf()
      .send({ username: 'test ci edited' })
      .expect(200);

    expect(sess?.value).toEqual(getCookie(agent, 'sess')?.value);
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

  it('Sets the deleteUser property of session', async () => {
    const agent = await login(httpServer, normalUser);

    const now = new Date(Date.now());

    await agent.post(url)
      .csrf()
      .expect(200)
      .expect(res => expect(res.body).toBeObject())
      .expect(res => expect(res.body.message).toBeString());

    const after = new Date(Date.now());

    const sessionToken = getSessionToken(agent);

    expect(sessionToken).toBeString();
    const sess = await db.one<{ deleteUser: Date | null }>`SELECT delete_user FROM sessions WHERE session_id=${sessionToken}`;
    expect(sess.deleteUser).toBeDate();
    expect(sess.deleteUser).toBeAfter(now);
    expect(sess.deleteUser).toBeBefore(after);
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
        emailVerified: expect.toBeOneOf([expect.any(Boolean), null]),
        isCredentialsAccount: oauthUser.isCredentialsAccount,
        lastActive: expect.any(String),
      },

      accounts: expect.arrayContaining([
        {
          id: expect.any(String),
          type: expect.any(String),
          provider: expect.any(String),
          providerAccountId: expect.any(String),
          expiresAt: expect.any(Number),
          tokenType: expect.toBeOneOf([expect.any(String), null]),
          scope: expect.toBeOneOf([expect.any(String), null]),
          userId: oauthUser.userUuid,
        },
      ]),

      follows: expect.any(Array),

      sessions: expect.arrayContaining([expect.any(Object)]),
    }));
  });
});
