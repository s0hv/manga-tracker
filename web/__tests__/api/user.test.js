import request from 'supertest';
import { insertFollow } from '../../db/follows';
import { csrfMissing } from '../../utils/constants';
import { mangaIdError, userUnauthorized } from '../constants';
import { expectOnlySessionInsert, spyOnDb } from '../dbutils';

import initServer from '../initServer';
import {
  expectAuthTokenRegenerated,
  expectSessionRegenerated,
} from '../requestUtils';
import stopServer from '../stopServer';
import {
  adminUser,
  expectErrorMessage,
  getCookie,
  login,
  normalUser,
  unsignCookie,
  withUser,
} from '../utils';
import { redis } from '../../utils/ratelimits';

let httpServer;

beforeAll(async () => {
  ({ httpServer } = await initServer());
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

  it('returns 400 with invalid email', async () => {
    await withUser(normalUser, async () => {
      const spy = spyOnDb();
      await request(httpServer)
        .post('/api/profile')
        .csrf()
        .send({ email: 'test@abc', password: 'notRealPassword' })
        .expect(400)
        .expect(expectErrorMessage('test@abc', 'email'));

      await request(httpServer)
        .post('/api/profile')
        .csrf()
        .set('Content-Type', 'application/json; charset=UTF-8')
        .send({ email: '🤠@🤠.com', password: 'notRealPassword' })
        .expect(400)
        .expect(expectErrorMessage('🤠@🤠.com', 'email'));

      expect(spy).toHaveBeenCalled();
      expectOnlySessionInsert(spy);
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

      expect(spy).toHaveBeenCalled();
      expectOnlySessionInsert(spy);
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

      expect(spy).toHaveBeenCalled();
      expectOnlySessionInsert(spy);
    });
  });

  it('returns 401 when editing email or changing password without giving old password', async () => {
    await withUser(normalUser, async () => {
      const spy = spyOnDb();

      await request(httpServer)
        .post('/api/profile')
        .csrf()
        .send({ email: 'test@email.com' })
        .expect(401)
        .expect(expectErrorMessage('Password required for modifying email'));

      await request(httpServer)
        .post('/api/profile')
        .csrf()
        .send({ newPassword: 'newPass123' })
        .expect(401)
        .expect(expectErrorMessage('Password required for modifying newPassword'));

      expect(spy).toHaveBeenCalled();
      expectOnlySessionInsert(spy);
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

      expect(spy).toHaveBeenCalled();
      expectOnlySessionInsert(spy);
    });
  });

  it('returns 422 when changing email to an existing email', async () => {
    const agent = await login(httpServer, normalUser);
    await agent
      .post('/api/profile')
      .csrf()
      .send({ email: adminUser.email, password: normalUser.password })
      .expect(422)
      .expect(expectErrorMessage('Email is already in use'));
  });

  it('returns 200 when changing email to a valid alternate email with remember me', async () => {
    const agent = await login(httpServer, normalUser, true);

    const oldAuth = getCookie(agent, 'auth');
    const oldSess = getCookie(agent, 'sess');
    expect(oldAuth).toBeDefined();
    expect(oldSess).toBeDefined();

    await agent
      .post('/api/profile')
      .csrf()
      .send({ email: normalUser.email, password: normalUser.password })
      .expect(200)
      .expect('set-cookie', /sess=/)
      .expect('set-cookie', /auth=/);

    await expectSessionRegenerated(agent, oldSess);
    await expectAuthTokenRegenerated(agent, oldAuth);
  });

  it('returns 200 when changing email to a valid alternate email without remember me', async () => {
    const agent = await login(httpServer, normalUser, false);

    const oldSess = getCookie(agent, 'sess');
    expect(oldSess).toBeDefined();

    await agent
      .post('/api/profile')
      .csrf()
      .send({ email: normalUser.email, password: normalUser.password })
      .expect(200)
      .expect('set-cookie', /sess=/);

    const auth = getCookie(agent, 'auth');
    expect(auth).toBeUndefined();

    await expectSessionRegenerated(agent, oldSess);
  });

  async function checkAndResetPassword(agent, newPassword, user) {
    // Make sure password doesn't work anymore
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

    const oldAuth = getCookie(agent, 'auth');
    const oldSess = getCookie(agent, 'sess');
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
      .expect('set-cookie', /sess=/)
      .expect('set-cookie', /auth=/);

    const sess = await expectSessionRegenerated(agent, oldSess);
    const auth = await expectAuthTokenRegenerated(agent, oldAuth);

    await checkAndResetPassword(agent, newPassword, normalUser);

    await expectSessionRegenerated(agent, sess);
    await expectAuthTokenRegenerated(agent, auth);
  });

  it('returns 200 when changing password without remember me', async () => {
    const agent = await login(httpServer, normalUser, false);

    const oldSess = getCookie(agent, 'sess');
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
      .expect('set-cookie', /sess=/);

    const sess = await expectSessionRegenerated(agent, oldSess);
    console.log(unsignCookie(sess.value));

    await checkAndResetPassword(agent, newPassword, normalUser);

    await expectSessionRegenerated(agent, sess);
  });

  it('returns 200 when changing username', async () => {
    const agent = await login(httpServer, normalUser, false);

    const sess = getCookie(agent, 'sess');

    await agent
      .post('/api/profile')
      .csrf()
      .send({ username: 'test ci edited' })
      .expect(200);

    expect(sess.value).toEqual(getCookie(agent, 'sess')?.value);
  });

  it('returns 200 when modifying all values at the same time', async () => {
    const agent = await login(httpServer, normalUser, true);

    const oldAuth = getCookie(agent, 'auth');
    const oldSess = getCookie(agent, 'sess');

    const newPassword = 'testPassword12345';

    await agent
      .post('/api/profile')
      .csrf()
      .send({
        newPassword: newPassword,
        repeatPassword: newPassword,
        password: normalUser.password,
        email: normalUser.email,
        username: normalUser.username,
      })
      .expect(200)
      .expect('set-cookie', /sess=/)
      .expect('set-cookie', /auth=/);

    const sess = await expectSessionRegenerated(agent, oldSess);
    const auth = await expectAuthTokenRegenerated(agent, oldAuth);

    await checkAndResetPassword(agent, newPassword, normalUser);

    await expectSessionRegenerated(agent, sess);
    await expectAuthTokenRegenerated(agent, auth);
  });
});
