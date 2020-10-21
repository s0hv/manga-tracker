import { MuiPickersUtilsProvider } from '@material-ui/pickers';
import DateFnsUtils from '@date-io/date-fns';
import enLocale from 'date-fns/locale/en-GB';
import request from 'supertest';
import React, { isValidElement } from 'react';
import { act } from 'react-dom/test-utils';
import signature from 'cookie-signature';

import { UserProvider } from '../src/utils/useUser';

export const adminUser = {
  user_id: 1,
  user_uuid: '22fc15c9-37b9-4869-af86-b334333dedd8',
  username: 'test ci admin',
  joined_at: new Date(Date.now()),
  theme: 2,
  admin: true,
  password: 'te!st-pa#ss)wo(rd123',
  email: 'test-admin@test.com',
};

export const normalUser = {
  user_id: 3,
  user_uuid: 'cf5eddfd-e0fe-4e6e-b339-70be6f33794d',
  username: 'test ci',
  joined_at: new Date(Date.now()),
  theme: 2,
  admin: false,
  password: 'te!st-pa#ss)wo(rd123',
  email: 'test@test.com',
};

export function mockUTCDates() {
  jest.spyOn(Date.prototype, 'getDate')
    .mockImplementation(jest.fn(function getDate() {
      return this.getUTCDate();
    }));

  jest.spyOn(Date.prototype, 'getDay')
    .mockImplementation(jest.fn(function getDay() {
      return this.getUTCDay();
    }));

  jest.spyOn(Date.prototype, 'getFullYear')
    .mockImplementation(jest.fn(function getFullYear() {
      return this.getUTCFullYear();
    }));

  jest.spyOn(Date.prototype, 'getHours')
    .mockImplementation(jest.fn(function getHours() {
      return this.getUTCHours();
    }));

  jest.spyOn(Date.prototype, 'getMilliseconds')
    .mockImplementation(jest.fn(function getMilliseconds() {
      return this.getUTCMilliseconds();
    }));

  jest.spyOn(Date.prototype, 'getMinutes')
    .mockImplementation(jest.fn(function getMinutes() {
      return this.getUTCMinutes();
    }));

  jest.spyOn(Date.prototype, 'getMonth')
    .mockImplementation(jest.fn(function getMonth() {
      return this.getUTCMonth();
    }));

  jest.spyOn(Date.prototype, 'getSeconds')
    .mockImplementation(jest.fn(function getSeconds() {
      return this.getUTCSeconds();
    }));

  jest.spyOn(Date.prototype, 'getTimezoneOffset')
    .mockImplementation(jest.fn(() => 0));
}

export async function withUser(userObject, cb) {
  if (isValidElement(cb)) {
    return (
      <UserProvider value={userObject}>
        {cb}
      </UserProvider>
    );
  }
  const { requiresUser } = require('../db/auth');

  requiresUser.mockImplementation((req, res, next) => {
    req.user = userObject;
    next();
  });

  try {
    await cb();
  } finally {
    // Restore the original function
    requiresUser.mockImplementation(jest.requireActual('./../db/auth').requiresUser);
  }
}

export function getCookie(agent, name) {
  return agent.jar.getCookie(name, { path: '/' });
}

export async function login(app, user, rememberMe=false) {
  const agent = request.agent(app);
  await agent
    .post('/api/login')
    .type('form')
    .send({
      email: user.email,
      password: user.password,
      rememberme: rememberMe ? 'on' : 'off',
    })
    .expect('set-cookie', /sess=/)
    .expect('set-cookie', rememberMe ? /auth=/ : /sess=/);

  if (!rememberMe) {
    expect(getCookie(agent, 'auth')).toBeUndefined();
  }

  expect(getCookie(agent, 'sess')).toBeDefined();

  return agent;
}

export function unsignCookie(value) {
  return signature.unsign(value.slice(2), 'secret');
}

export async function editInput(input, value) {
  await act(async () => {
    input.simulate('change', { target: { value }, currentTarget: { value }});
    input.instance().value = value;
  });
}

export function withRoot(Component) {
  return (
    <MuiPickersUtilsProvider utils={DateFnsUtils} locale={enLocale}>
      {Component}
    </MuiPickersUtilsProvider>
  );
}

export function expectErrorMessage(value, param, message='Invalid value') {
  return (res) => {
    expect(res.body).toBeObject();
    let errors = res.body.error;
    expect(errors).toBeDefined();

    let error;

    if (typeof errors === 'string') {
      expect(errors).toMatch(value);
      return;
    }

    if (Array.isArray(errors)) {
      if (param) {
        // Only get errors related to the given parameter
        errors = errors.filter(err => err.param === param);
      }
      expect(errors).toHaveLength(1);
      error = errors[0];
    } else {
      error = errors;
    }

    expect(error.msg).toMatch(message);
    if (typeof param === 'string') {
      expect(error.param).toEqual(param);
    }

    expect(error.value).toEqual(value);
  };
}
