import { getServiceConfigs } from '@/db/services';

afterAll(async () => {
  const { end } = await import('../../../db');
  await end();
});

describe('getServiceConfigs()', () => {
  it('Returns service configs', async () => {
    const configs = await getServiceConfigs();
    expect(configs.length).toBeGreaterThan(0);

    const service = configs[0];
    expect(service).toHaveProperty('serviceId');
    expect(service).toHaveProperty('checkInterval');
    expect(service).toHaveProperty('scheduledRunLimit');
    expect(service).toHaveProperty('scheduledRunsEnabled');
    expect(service).toHaveProperty('scheduledRunInterval');
  });
});
