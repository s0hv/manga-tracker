import { getServices } from '../../../db/services/serviceInfo';

afterAll(async () => {
  const { pgp } = require('../../../db');
  await pgp.end();
});

describe('getServices()', () => {
  it('Returns services', async () => {
    const services = await getServices();
    expect(services.length).toBeGreaterThan(0);

    const service = services[0];
    expect(service).toHaveProperty('id');
    expect(service).toHaveProperty('service_name');
    expect(service).toHaveProperty('disabled');
    expect(service).toHaveProperty('url');
    expect(service).toHaveProperty('last_check');
  });
});
