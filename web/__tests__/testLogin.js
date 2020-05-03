/* eslint-env jest */

import serverPromise from '../server';
import fetch from 'node-fetch'

const { redis } = require('./../utils/ratelimits')

const cookie = require('cookie');


let httpServer;
let addr;

beforeAll(async () => {
  httpServer = await serverPromise;
  addr = `http://localhost:${httpServer.address().port}`;
});

beforeEach(async () => {
  await redis.flushall();
})

function createBody(opts) {
  const params = new URLSearchParams();
  Object.entries(opts).forEach((keyval) => params.append(keyval[0], keyval[1]));
  return params.toString();
}

function checkCookies(res, required= [], notAllowed= []) {
  const cookies = {};
  res.headers.raw()['set-cookie'].forEach(c => {
    const parsed = cookie.parse(c)
    for (let i=0; i<required.length; i++) {
      if (parsed[required[i]] !== undefined) {
        cookies[required[i]] = c;
        required.splice(i, 1);
        return
      }
    }

    for (let i=0; i<notAllowed.length; i++) {
      if (c[notAllowed[i]]) {
        throw new Error(`Unallowed cookie found ${c}`);
      }
    }
  });

  if (required.length > 0) {
    throw new Error(`Not all required cookies found ${required}`);
  }
  return cookies;
}

describe('Login flow', () => {

  const loginOpts = {
    method: 'post',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
    }
  }
  const realUser = {
    email: 't@t.t',
    password: '1234'
  }

  const fakeUser = {
    email: 'a@b.c',
    password: 'aaaaaaa'
  }

  const wrongPassword = {
    email: 't@t.t',
    password: 'aaaaaaa'
  }

  const wrongEmail = {
    email: 'wrong@t.t',
    password: '1234'
  }

  const tooLongPassword = {
    email: 'wrong@t.t',
    password: '123412341234123412341234123412341234123412341234'.repeat(3)
  }

  test('Invalid logins', async () => {
    let res = await fetch(`${addr}/api/authCheck`);
    expect(await res.json()).toStrictEqual({user: null});


    for (let body of [wrongEmail, wrongPassword, fakeUser, tooLongPassword])
      res = await fetch(`${addr}/api/login`, {
        ...loginOpts,
        body: createBody(body)
      });
      expect(res.headers.get('set-cookie')).toBeFalsy();
      expect(await res.text()).toContain('Unauthorized')

      res = await fetch(`${addr}/api/authCheck`);
      expect(await res.json()).toStrictEqual({user: null});

    // Test completely invalid login token
    res = await fetch(`${addr}/api/authCheck`, {
      headers: {
        cookies: encodeURIComponent('aeffaf;argregtrsegikogtgetrh;arteiogfjaoeirjg')
      }
    });
    expect(res.headers.get('set-cookie')).toBeFalsy();
    expect(await res.json()).toStrictEqual({user: null});
  });

  test('Valid user', async () => {
    // Check login with a real user
    let res = await fetch(`${addr}/api/login`, {
      ...loginOpts,
      body: createBody(realUser)
    });
    expect(res.headers.get('set-cookie')).toBeTruthy();
    expect(res.headers.get('location')).toEqual(addr + '/')
    // Make sure remember me cookie wasn't set
    let cookies = checkCookies(res, ['sess'], ['auth']);

    res = await fetch(`${addr}/api/authCheck`, {
      headers: {
        cookie: cookies.sess
      }
    });
    expect(await res.json()).not.toStrictEqual({user: null});

    // Check login with a real user and remember me on
    res = await fetch(`${addr}/api/login`, {
      ...loginOpts,
      body: createBody({...realUser, rememberme: 'on'})
    });
    expect(res.headers.get('set-cookie')).toBeTruthy();
    expect(res.headers.get('location')).toEqual(addr + '/')
    // Make sure remember me cookie wasn't set
    cookies = checkCookies(res, ['sess', 'auth']);

    res = await fetch(`${addr}/api/authCheck`, {
      headers: {
        cookie: cookies.sess
      }
    });
    expect(await res.json()).not.toStrictEqual({user: null});


    res = await fetch(`${addr}/api/authCheck`, {
      headers: {
        cookie: cookies.auth
      }
    });
    let newCookies = checkCookies(res, ['sess', 'auth']);

    // Make sure session id and token were regenerated
    expect(cookie.parse(newCookies.sess).sess).not.toStrictEqual(cookie.parse(cookies.sess).sess);
    const oldAuth = cookie.parse(cookies.auth);
    const auth = cookie.parse(newCookies.auth);
    expect(oldAuth.auth).not.toStrictEqual(auth.auth);
    expect(auth.expiry).toEqual(oldAuth.expiry);

    // Check that the given session works
    res = await fetch(`${addr}/api/authCheck`, {
      headers: {
        cookie: newCookies.sess
      }
    });
    expect(await res.json()).not.toStrictEqual({user: null});

    // Make sure the old token was invalidated
    res = await fetch(`${addr}/api/authCheck`, {
      headers: {
        cookie: cookies.auth
      }
    });
    newCookies = checkCookies(res, ['auth']);
    expect(cookie.parse(newCookies.auth).auth).toBeFalsy();
    expect(await res.json()).toStrictEqual({user: null});

  });

  test('Login rate limit', async () => {
    for (let i=0; i < 15; i++) {
      await fetch(`${addr}/api/login`, {method: 'post'});
    }

    // Make sure rate limiting activated
    let res = await fetch(`${addr}/api/login`, {method: 'post'});
    expect(res.status).toStrictEqual(429);
    let resp = await res.json();

    // Make sure rate limits increase for each failed attempt
    res = await fetch(`${addr}/api/login`, {method: 'post'});
    expect(res.status).toStrictEqual(429);
    expect((await res.json()).error.nextValidRequestDate).not.toEqual(resp.error.nextValidRequestDate)

  })
});

afterAll(() => {
  httpServer.close();
  require('./../db').end()
  redis.disconnect()
})