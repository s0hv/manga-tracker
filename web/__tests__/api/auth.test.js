import request from 'supertest';
import { clearUserCache } from '../../db/auth';
import {
  authTokenCount,
  authTokenExists,
  sessionAssociatedWithUser,
  userSessionCount,
} from '../dbutils';
import { redis } from '../../utils/ratelimits';

import initServer from '../initServer';
import { expectAuthTokenRegenerated } from '../requestUtils';
import stopServer from '../stopServer';
import {
  adminUser,
  authTestUser,
  decodeAuthToken,
  deleteCookie,
  encodeAuthToken,
  expectCookieDeleted,
  getCookie, getCookieFromRes,
  headerNotPresent,
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

describe('POST /api/login', () => {
  it('Returns 400 with only email or password or nothing', async () => {
    await request(httpServer)
      .post('/api/login')
      .send({})
      .expect(400);

    await request(httpServer)
      .post('/api/login')
      .send({ email: 'test' })
      .expect(400);

    await request(httpServer)
      .post('/api/login')
      .send({ password: 'test' })
      .expect(400);
  });

  it('Returns 415 with invalid content type', async () => {
    await request(httpServer)
      .post('/api/login')
      .expect(415);

    await request(httpServer)
      .post('/api/login')
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
      .send(wrongEmail)
      .redirects(0)
      .expect(headerNotPresent('set-cookie'))
      .expect(401);

    await request(httpServer)
      .post('/api/login')
      .send(wrongPassword)
      .redirects(0)
      .expect(headerNotPresent('set-cookie'))
      .expect(401);

    await request(httpServer)
      .post('/api/login')
      .send(tooLongPassword)
      .redirects(0)
      .expect(headerNotPresent('set-cookie'))
      .expect(401);

    await request(httpServer)
      .post('/api/login')
      .send(fakeUser)
      .redirects(0)
      .expect(headerNotPresent('set-cookie'))
      .expect(401);
  });

  it('Returns 200 with valid user', async () => {
    await request(httpServer)
      .post('/api/login')
      .send(realUser)
      .redirects(0)
      .expect('set-cookie', /sess=/)
      .expect('set-cookie', /^((?!auth=).)*$/)
      .expect(302);

    await request(httpServer)
      .post('/api/login')
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
          .send(fakeUser))
    );

    let nextValidRequestDate;
    await request(httpServer)
      .post('/api/login')
      .send(fakeUser)
      .expect(res => { nextValidRequestDate = res.body.error.nextValidRequestDate })
      .expect(429);

    await request(httpServer)
      .post('/api/login')
      .send(fakeUser)
      .expect(res => {
        expect(nextValidRequestDate).not.toEqual(res.body.error.nextValidRequestDate);
      })
      .expect(429);
  });
});

describe('POST /api/logout', () => {
  it('Returns 302 without logging in', async () => {
    await request(httpServer)
      .post('/api/logout')
      .expect(headerNotPresent('set-cookie'))
      .expect(302);
  });

  it('Returns 302 with login and without remember me', async () => {
    const agent = await login(httpServer, normalUser);
    const sess = getCookie(agent, 'sess');

    await agent
      .post('/api/logout')
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

describe('Test authentication', () => {
  it('/api/authCheck does not work with an invalid auth token', async () => {
    const token = encodeURIComponent('aeffaf;argregtrsegikogtgetrh;arteiogfjaoeirjg');
    await request(httpServer)
      .get('/api/authCheck')
      .set('Cookie', `auth=${token}`)
      .expect('')
      .expect(expectCookieDeleted('auth'))
      .expect(401);
  });

  it('Invalidates all tokens and sessions when uuid and lookup are correct', async () => {
    const agent = await login(httpServer, authTestUser, true);
    const auth = getCookie(agent, 'auth');
    const sess = getCookie(agent, 'sess');

    const [lookup, token, uuid] = decodeAuthToken(auth.value);

    const fakeToken = encodeAuthToken(
      lookup,
      token.split('').reverse().join(''),
      uuid
    );

    await request(httpServer)
      .get('/api/authCheck')
      .set('Cookie', `auth=${fakeToken}`)
      .expect(expectCookieDeleted('auth'))
      .expect(401);

    // Make sure sessions and tokens deleted
    expect(await authTokenCount(uuid)).toStrictEqual(0);
    expect(await userSessionCount(uuid)).toStrictEqual(0);

    // Make sure session does not exist
    await request(httpServer)
      .get('/api/authCheck')
      .set('Cookie', `sess=${sess.value}`)
      .expect(401);
  });

  it('Does not work with correct token and lookup, but wrong uuid', async () => {
    const agent = await login(httpServer, adminUser, true);
    const auth = getCookie(agent, 'auth');

    const [lookup, token, uuid] = decodeAuthToken(auth.value);

    const fakeToken = encodeAuthToken(
      lookup,
      token.split('').reverse().join(''),
      uuid.split('').reverse().join('')
    );

    await request(httpServer)
      .get('/api/authCheck')
      .set('Cookie', `auth=${fakeToken}`)
      .expect(expectCookieDeleted('auth'))
      .expect(401);

    expect(await authTokenCount(uuid)).toBeGreaterThan(0);
    expect(await userSessionCount(uuid)).toBeGreaterThan(0);
  });

  it('Regenerates token when presenting auth but no session', async () => {
    const agent = await login(httpServer, adminUser, true);
    const auth = getCookie(agent, 'auth');
    deleteCookie(agent, 'sess');

    await agent
      .get('/api/authCheck')
      .expect('set-cookie', /sess=/)
      .expect(200);

    await expectAuthTokenRegenerated(agent, auth);
  });

  it('Finds user when it is not in the cache', async () => {
    const agent = await login(httpServer, adminUser, true);
    const auth = getCookie(agent, 'auth');
    deleteCookie(agent, 'sess');
    clearUserCache();

    await agent
      .get('/api/authCheck')
      .expect('set-cookie', /sess=/)
      .expect(200);

    await expectAuthTokenRegenerated(agent, auth);

    clearUserCache();
    await agent
      .get('/api/authCheck')
      .expect('content-type', /json/)
      .expect(200);
  });

  it('Resets cookie with invalid uuid', async () => {
    const agent = await login(httpServer, adminUser, true);
    const auth = getCookie(agent, 'auth');

    const [lookup, token, uuid] = decodeAuthToken(auth.value);

    const fakeToken = encodeAuthToken(
      lookup,
      token,
      uuid + 'a'
    );

    await request(httpServer)
      .get('/api/authCheck')
      .set('Cookie', `auth=${fakeToken}`)
      .expect(expectCookieDeleted('auth'))
      .expect(400);
  });

  it('Does not reset token with fast requests with the same token', async () => {
    const agent = await login(httpServer, adminUser, true);
    const auth = getCookie(agent, 'auth');
    deleteCookie(agent, 'sess');

    const tokens = [];
    await Promise.all(Array(5)
      .fill(0)
      .map(() => request(httpServer)
        .get('/api/authCheck')
        .set('Cookie', `auth=${auth.value}`)
        .expect((res) => {
          const c = getCookieFromRes(res, 'auth');
          if (c) {
            tokens.push(c.auth);
          }
        })
        .expect(200)));

    expect(tokens).toHaveLength(1);
    const newToken = tokens[0];
    expect(newToken).not.toEqual(auth.value);

    expect(await authTokenExists(auth.value)).toBeFalse();
  });
});
