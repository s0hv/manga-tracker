import core from '@actions/core';

export default async () => {
  jest.mock('./../db/auth', () => ({
    ...jest.requireActual('./../db/auth'),
    requiresUser: jest.fn().mockImplementation(jest.requireActual('./../db/auth').requiresUser),
  }));
  const serverPromise = require('../server');
  process.env.PORT = '0';
  const httpServer = await serverPromise;
  expect(httpServer).toBeDefined();

  const addr = `http://localhost:${httpServer.address().port}`;
  console.error(`Testing address ${addr}`);

  return {
    httpServer,
    addr,
  };
};
