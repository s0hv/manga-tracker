import request from 'supertest';
import { csrfMissing } from '../../server/utils/constants';
import { authTokenExists, sessionAssociatedWithUser } from '../dbutils';
import { redis } from '../../server/utils/ratelimits';

import initServer from '../initServer';
import stopServer from '../stopServer';
import {
  expectCookieDeleted,
  expectErrorMessage,
  getCookie,
  login,
  normalUser,
} from '../utils';

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

const fakeUser = {
  email: 'a@b.c',
  password: 'aaaaaaa',
};

const wrongPassword = {
  email: normalUser.email,
  password: normalUser.password + 'a',
};

const wrongEmail = {
  email: normalUser.email + 'a',
  password: normalUser.password,
};

const tooLongPassword = {
  email: normalUser.email,
  password: '123412341234123412341234123412341234123412341234'.repeat(3),
};

const realUser = {
  email: normalUser.email,
  password: normalUser.password,
};

describe.skip('POST /api/login', () => {
  it('Returns 403 without CSRF token', async () => {
    await request(httpServer)
      .post('/api/login')
      .send(realUser)
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('Returns 400 with only email or password or nothing', async () => {
    await request(httpServer)
      .post('/api/login')
      .csrf()
      .send({})
      .expect(400);

    await request(httpServer)
      .post('/api/login')
      .csrf()
      .send({ email: 'test' })
      .expect(400);

    await request(httpServer)
      .post('/api/login')
      .csrf()
      .send({ password: 'test' })
      .expect(400);
  });

  it('Returns 415 with invalid content type', async () => {
    await request(httpServer)
      .post('/api/login')
      .csrf()
      .expect(415);

    await request(httpServer)
      .post('/api/login')
      .csrf()
      .type('form')
      .send({
        email: 'test',
        password: 'test',
      })
      .expect(415);
  });

  it('Returns 401 with invalid credentials', async () => {
    await request(httpServer)
      .post('/api/login')
      .csrf()
      .send(wrongEmail)
      .redirects(0)
      .expect(401);

    await request(httpServer)
      .post('/api/login')
      .csrf()
      .send(wrongPassword)
      .redirects(0)
      .expect(401);

    await request(httpServer)
      .post('/api/login')
      .csrf()
      .send(tooLongPassword)
      .redirects(0)
      .expect(401);

    await request(httpServer)
      .post('/api/login')
      .csrf()
      .send(fakeUser)
      .redirects(0)
      .expect(401);
  });

  it('Returns 200 with valid user', async () => {
    await request(httpServer)
      .post('/api/login')
      .csrf()
      .send(realUser)
      .redirects(0)
      .expect('set-cookie', /sess=/)
      .expect('set-cookie', /^((?!auth=).)*$/)
      .expect(302);

    await request(httpServer)
      .post('/api/login')
      .csrf()
      .send({
        ...realUser,
        rememberme: true,
      })
      .redirects(0)
      .expect('set-cookie', /sess=/)
      .expect('set-cookie', /auth=/)
      .expect(302);
  });

  it('Ratelimits on bruteforce attempts failures', async () => {
    await Promise.all(
      Array(20)
        .fill(0)
        .map(() => request(httpServer)
          .post('/api/login')
          .csrf()
          .send(fakeUser))
    );

    let nextValidRequestDate;
    await request(httpServer)
      .post('/api/login')
      .csrf()
      .send(fakeUser)
      .expect(res => { nextValidRequestDate = res.body.error.nextValidRequestDate })
      .expect(429);

    await request(httpServer)
      .post('/api/login')
      .csrf()
      .send(fakeUser)
      .expect(res => {
        expect(nextValidRequestDate).not.toEqual(res.body.error.nextValidRequestDate);
      })
      .expect(429);
  });
});

describe.skip('POST /api/logout', () => {
  it('Returns 403 without CSRF token', async () => {
    await request(httpServer)
      .post('/api/logout')
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('Returns 302 without logging in', async () => {
    await request(httpServer)
      .post('/api/logout')
      .csrf()
      .expect(302);
  });

  it('Returns 302 with login and without remember me', async () => {
    const agent = await login(httpServer, normalUser);
    const sess = getCookie(agent, 'sess');

    await agent
      .post('/api/logout')
      .csrf()
      .expect('location', '/')
      .expect(expectCookieDeleted('sess'))
      .expect(302);

    expect(getCookie(agent, 'sess')).toBeUndefined();
    expect(await sessionAssociatedWithUser(sess.value)).toBeFalse();
  });

  it('Returns 302 with login and remember me', async () => {
    const agent = await login(httpServer, normalUser, true);
    const sess = getCookie(agent, 'sess');
    const auth = getCookie(agent, 'auth');

    await agent
      .post('/api/logout')
      .csrf()
      .expect('location', '/')
      .expect(expectCookieDeleted('sess'))
      .expect(expectCookieDeleted('auth'))
      .expect(302);

    expect(getCookie(agent, 'sess')).toBeUndefined();
    expect(getCookie(agent, 'auth')).toBeUndefined();

    expect(await sessionAssociatedWithUser(sess.value)).toBeFalse();
    expect(await authTokenExists(auth.value)).toBeFalse();
  });
});

