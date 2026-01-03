import { notFound } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';

import { getServiceConfigs } from '@/db/services';
import { getServices } from '@/db/services/serviceInfo';
import type { ServiceForAdmin } from '@/types/api/services';
import type { ServiceConfig } from '@/types/db/services';
import { jsonSerializable } from '@/webUtils/utilities';

export const getServiceConfigsFn = createServerFn()
  .handler(async ({ context }) => {
    if (context.user?.admin !== true) {
      throw notFound();
    }

    const serviceConfigs = await getServiceConfigs();

    return jsonSerializable(serviceConfigs) as ServiceConfig[];
  });

export const getServicesFn = createServerFn()
  .handler(async ({ context }) => {
    if (context.user?.admin !== true) {
      throw notFound();
    }

    const services = await getServices();

    return jsonSerializable(services) as ServiceForAdmin[];
  });
