/* eslint-env jest */

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

export async function withUser(userObject, cb) {
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
