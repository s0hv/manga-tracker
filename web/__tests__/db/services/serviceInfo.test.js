import { getServices } from '../../../db/services/serviceInfo';

afterAll(async () => {
  const { end } = require('../../../db');
  await end();
});

describe('getServices()', () => {
  it('Returns services', async () => {
    const services = await getServices();
    expect(services.length).toBeGreaterThan(0);

    const service = services[0];
    expect(service).toHaveProperty('id');
    expect(service).toHaveProperty('serviceName');
    expect(service).toHaveProperty('disabled');
    expect(service).toHaveProperty('url');
    expect(service).toHaveProperty('lastCheck');
  });
});
