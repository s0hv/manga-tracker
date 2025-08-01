import { parse, toSeconds } from 'iso8601-duration';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { copyService } from '@/tests/dbutils';
import initServer from '@/tests/initServer';
import stopServer from '@/tests/stopServer';
import {
  adminUser,
  expectErrorMessage,
  getErrorMessage,
  getIncrementalStringGenerator,
  mockUTCDates,
  normalUser,
  withUser,
} from '@/tests/utils';
import { getServiceFull } from '@/db/services';
import { csrfMissing } from '@/serverUtils/constants';
import { isCI, userForbidden, userUnauthorized } from '@/tests/constants';
import type { Service, ServiceConfig, ServiceWhole } from '@/types/db/services';

let httpServer: any;

beforeAll(async () => {
  ({ httpServer } = await initServer());
});

afterAll(async () => stopServer(httpServer));

describe('POST /api/admin/editService/:serviceId', () => {
  mockUTCDates();
  const url = '/api/admin/editService/3';
  const serviceId = 3;
  const baseBody = {
    service: {
      serviceName: undefined,
      disabled: undefined,
    },
    serviceWhole: {
      nextUpdate: undefined,
    },
    serviceConfig: {
      checkInterval: undefined,
      scheduledRunLimit: undefined,
      scheduledRunsEnabled: undefined,
      scheduledRunInterval: undefined,
    },
  };

  it('Returns 403 without CSRF token', async () => {
    await request(httpServer)
      .post(url)
      .expect(403)
      .expect(expectErrorMessage(csrfMissing));
  });

  it('returns unauthorized without user', async () => {
    await request(httpServer)
      .post(url)
      .csrf()
      .expect(401)
      .expect(expectErrorMessage(userUnauthorized));
  });

  it('returns forbidden for non admin', async () => {
    await withUser(normalUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .expect(403)
        .expect(expectErrorMessage(userForbidden));
    });
  });

  it('returns 400 for admin without data', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .expect(400)
        .expect(expectErrorMessage('No valid fields given to update'));

      await request(httpServer)
        .post(url)
        .csrf()
        .send({})
        .expect(400)
        .expect(expectErrorMessage('No valid fields given to update'));

      await request(httpServer)
        .post(url)
        .csrf()
        .send(baseBody)
        .expect(400)
        .expect(expectErrorMessage('No valid fields given to update'));
    });
  });

  it('Returns 400 with invalid service data', async () => {
    await withUser(adminUser, async () => {
      // service_name
      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          service: {
            serviceName: [1, 2, 3],
          },
        })
        .expect(400)
        .expect(expectErrorMessage([1, 2, 3], 'service.serviceName'));

      // disabled
      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          service: {
            disabled: '2',
          },
        })
        .expect(400)
        .expect(expectErrorMessage('2', 'service.disabled'));

      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          service: {
            disabled: null,
          },
        })
        .expect(400)
        .expect(expectErrorMessage(null, 'service.disabled'));
    });
  });

  it('Returns 400 with invalid service whole data', async () => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          serviceWhole: {
            nextUpdate: 'abc',
          },
        })
        .expect(400)
        .expect(expectErrorMessage('abc', 'serviceWhole.nextUpdate'));

      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          serviceWhole: {
            nextUpdate: 1602954767,
          },
        })
        .expect(400)
        .expect(expectErrorMessage(1602954767, 'serviceWhole.nextUpdate'));
    });
  });

  it('Returns 400 with invalid service config data', async () => {
    await withUser(adminUser, async () => {
      // checkInterval and scheduledRunInterval
      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          serviceConfig: {
            checkInterval: '3Y6M4DT12H30M5S',
            scheduledRunInterval: '3Y6M4DT12H30M5S',
          },
        })
        .expect(400)
        .expect(res => expect(getErrorMessage(res)).toMatchSnapshot());

      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          serviceConfig: {
            checkInterval: 'T12H30M5S',
            scheduledRunInterval: 'T12H30M5S',
          },
        })
        .expect(400)
        .expect(res => expect(getErrorMessage(res)).toMatchSnapshot());


      // scheduledRunLimit
      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          serviceConfig: {
            scheduledRunLimit: 'a',
          },
        })
        .expect(400)
        .expect(res => expect(getErrorMessage(res)).toMatchSnapshot());

      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          serviceConfig: {
            scheduledRunLimit: 101,
          },
        })
        .expect(400)
        .expect(res => expect(getErrorMessage(res)).toMatchSnapshot());

      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          serviceConfig: {
            scheduledRunLimit: 0,
          },
        })
        .expect(400)
        .expect(res => expect(getErrorMessage(res)).toMatchSnapshot());


      // scheduledRunsEnabled
      await request(httpServer)
        .post(url)
        .csrf()
        .send({
          serviceConfig: {
            scheduledRunsEnabled: 'y',
          },
        })
        .expect(400)
        .expect(expectErrorMessage('y', 'serviceConfig.scheduledRunsEnabled'));
    });
  });

  const expectUpdateDoneCorrectly = async (data: {
    service?: Partial<Service> | null
    serviceWhole?: Partial<ServiceWhole> | null
    serviceConfig?: Partial<Omit<ServiceConfig, 'checkInterval' | 'scheduledRunInterval'> & { checkInterval: string, scheduledRunInterval: string }> | null
  }) => {
    await withUser(adminUser, async () => {
      await request(httpServer)
        .post(url)
        .csrf()
        .send(data)
        .expect(200);

      await new Promise(setImmediate);
      // Sleep for a bit here to make sure changes get flushed to database
      await new Promise(r => setTimeout(r, 20));

      const newServiceId = isCI ? await copyService(serviceId) : serviceId;

      const originalService = await getServiceFull(newServiceId);
      originalService.serviceConfig!.checkInterval = toSeconds(originalService.serviceConfig!.checkInterval) as any;
      originalService.serviceConfig!.scheduledRunInterval = toSeconds(originalService.serviceConfig!.scheduledRunInterval) as any;

      if (data.service) {
        expect(originalService.service).toMatchObject(data.service);
      }
      if (data.serviceWhole) {
        expect(originalService.serviceWhole).toMatchObject(data.serviceWhole);
      }
      if (data.serviceConfig) {
        expect(originalService.serviceConfig).toMatchObject({
          ...data.serviceConfig,
          checkInterval: toSeconds(parse(data.serviceConfig.checkInterval!)),
          scheduledRunInterval: toSeconds(parse(data.serviceConfig.scheduledRunInterval!)),
        });
      }
    });
  };
  const nameGen = getIncrementalStringGenerator('servicesApi');

  it('returns ok when editing with valid data full', async () => {
    await expectUpdateDoneCorrectly({
      service: {
        serviceName: nameGen(),
        disabled: true,
      },
      serviceWhole: {
        nextUpdate: new Date(1602954767000),
      },
      serviceConfig: {
        checkInterval: 'P1Y1M1DT1H1M1S',
        scheduledRunInterval: 'P0Y6M1DT0H30M5S',
        scheduledRunLimit: 5,
        scheduledRunsEnabled: false,
      },
    });
  });

  it('returns ok when editing with only service data', async () => {
    await expectUpdateDoneCorrectly(
      {
        service: {
          serviceName: nameGen(),
          disabled: false,
        },
      }
    );
  });

  it('returns ok when editing only service whole data', async () => {
    await expectUpdateDoneCorrectly({
      serviceWhole: {
        nextUpdate: new Date(1702954767000),
      },
    });
  });

  it('returns ok when editing only service config data', async () => {
    await expectUpdateDoneCorrectly({
      serviceConfig: {
        checkInterval: 'P1Y0M1DT1H0M5S',
        scheduledRunInterval: 'P0Y0M4DT12H3M8S',
        scheduledRunLimit: 10,
        scheduledRunsEnabled: true,
      },
    });
  });
});
