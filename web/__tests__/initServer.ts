import { Server } from 'http';
import { type AddressInfo } from 'net';
import { vi } from 'vitest';

vi.mock('./../db/auth', async () => {
  const auth = await vi.importActual<typeof import('./../db/auth')>('./../db/auth');
  return {
    ...auth,
    requiresUser: vi.fn().mockImplementation(auth.requiresUser),
  };
});

export default async function initServer(): Promise<{ httpServer: Server, addr: string }> {
  vi.mock('./../db/elasticsearch', async () => {
    const { Client } = await import('@elastic/elasticsearch');
    const { default: Mock } = await import('@elastic/elasticsearch-mock');
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

    mock.add({
      method: ['POST', 'DELETE'],
      path: ['/:index/_update/:id', '/:index/_doc/:id'],
    }, () => ({ status: 'OK' }));

    return {
      default: new Client({
        node: 'http://localhost:9200',
        Connection: mock.getConnection(),
      }),
    };
  });

  process.env.PORT = '0';
  const httpServer = await import('../server').then(m => m.default) as Server;
  expect(httpServer).toBeDefined();

  const addr = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
  console.log(`Testing address ${addr}`);

  return {
    httpServer,
    addr,
  };
}
