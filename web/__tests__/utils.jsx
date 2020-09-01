/* eslint-env jest */

import { MuiPickersUtilsProvider } from '@material-ui/pickers';
import DateFnsUtils from '@date-io/date-fns';
import enLocale from 'date-fns/locale/en-GB';
import React, { isValidElement } from 'react';
import { act } from 'react-dom/test-utils';

import { UserProvider } from '../src/utils/useUser';

export const adminUser = {
  user_id: 99,
  user_uuid: 'f6382674-efbd-4746-b3be-77566c337a8b',
  username: 'admin',
  joined_at: new Date(Date.now()),
  theme: 1,
  admin: true,
};

export const normalUser = {
  user_id: 5,
  user_uuid: '9c5da998-6287-4c81-806c-a2d452c2bac5',
  username: 'no perms',
  joined_at: new Date(Date.now()),
  theme: 1,
  admin: false,
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
