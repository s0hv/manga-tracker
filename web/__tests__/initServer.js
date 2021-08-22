export default async function initServer() {
  jest.mock('./../db/auth', () => ({
    ...jest.requireActual('./../db/auth'),
    requiresUser: jest.fn().mockImplementation(jest.requireActual('./../db/auth').requiresUser),
  }));

  jest.mock('./../db/elasticsearch', () => {
    const { Client } = require('@elastic/elasticsearch');
    const Mock = require('@elastic/elasticsearch-mock');
    const mock = new Mock();

    mock.add({
      method: ['GET', 'POST'],
      path: ['/_search', '/:index/_search'],
    }, () => ({ hits: { hits: []}}));

    // https://github.com/elastic/elasticsearch-js-mock/issues/18#issuecomment-900365420
    // Needed as the es client >=@7.14.0 validates whether it is connected to a real ES instance
    // by GETting / and checking these fields in the response
    mock.add({ method: 'GET', path: '/' }, () => ({
      name: 'mocked-es-instance',
      version: {
        number: '7.12.1',
        build_flavor: 'default',
      },
      tagline: 'You Know, for Search',
    }));

    return new Client({
      node: 'http://localhost:9200',
      Connection: mock.getConnection(),
    });
  });

  const serverPromise = require('../server');
  process.env.PORT = '0';
  const httpServer = await serverPromise;
  expect(httpServer).toBeDefined();

  const addr = `http://localhost:${httpServer.address().port}`;
  console.log(`Testing address ${addr}`);

  return {
    httpServer,
    addr,
  };
}
