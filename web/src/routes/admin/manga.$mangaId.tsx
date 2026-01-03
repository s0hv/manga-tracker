import React from 'react';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { ConfirmProvider } from 'material-ui-confirm';

import {
  DefaultLocalizationProvider,
} from '@/components/DefaultLocalizationProvider';
import Manga from '@/views/admin/MangaAdmin';
import { defineMeta } from '@/webUtils/meta';
import { isInteger } from '@/webUtils/utilities';

import { getMangaServicesQueryOptions } from '../../api/admin/manga';
import { getServicesQueryOptions } from '../../api/services';
import { getFullMangaFn } from '../../serverFunctions/manga';
import { getServiceConfigsFn } from '../../serverFunctions/services';
import { validateIsAdminUserFn } from '../../serverFunctions/validation';

export const Route = createFileRoute('/admin/manga/$mangaId')({
  beforeLoad: async ({ params }) => {
    if (!isInteger(params.mangaId)) {
      throw notFound();
    }

    await validateIsAdminUserFn();
  },
  loader: async ({ context, params, serverContext }) => {
    // If we are the client, we can prefetch query data early
    if (!serverContext) {
      void context.queryClient.ensureQueryData(getMangaServicesQueryOptions(params.mangaId));
      void context.queryClient.ensureQueryData(getServicesQueryOptions);
    }

    const [mangaData, serviceConfigs] = await Promise.all([
      getFullMangaFn(context.queryClient, params.mangaId),
      getServiceConfigsFn(),
    ]);

    return {
      mangaData,
      serviceConfigs,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};

    const { manga } = loaderData.mangaData;

    return {
      meta: defineMeta({
        title: manga.title,
        denyRobots: true,
      }),
    };
  },
  component: MangaPage,
});


function MangaPage() {
  const {
    mangaData,
    serviceConfigs,
  } = Route.useLoaderData();

  return (
    <DefaultLocalizationProvider>
      <ConfirmProvider>
        <Manga mangaData={mangaData} serviceConfigs={serviceConfigs} />
      </ConfirmProvider>
    </DefaultLocalizationProvider>
  );
}
