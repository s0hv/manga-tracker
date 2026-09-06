import React from 'react';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { ConfirmProvider } from 'material-ui-confirm';


import { getMangaServicesQueryOptions } from '#web/api/admin/manga';
import { servicesQueryOptions } from '#web/api/services';
import { getFullMangaFn } from '#web/serverFunctions/manga';
import { getServiceConfigsFn } from '#web/serverFunctions/services';
import { validateIsAdminUserFn } from '#web/serverFunctions/validation';
import {
  DefaultLocalizationProvider,
} from '@/components/DefaultLocalizationProvider';
import Manga from '@/views/admin/MangaAdmin';
import { defineMeta } from '@/webUtils/meta';
import { isInteger } from '@/webUtils/utilities';

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
      void context.queryClient.query({ ...getMangaServicesQueryOptions(params.mangaId), staleTime: 'static' });
      void context.queryClient.query({ ...servicesQueryOptions, staleTime: 'static' });
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
