import React from 'react';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { getUserFollowsFn } from '#web/serverFunctions/follows';
import { getFullMangaFn } from '#web/serverFunctions/manga';
import Manga from '@/components/Manga';
import { defineMeta } from '@/webUtils/meta';
import { isInteger } from '@/webUtils/utilities';


export const Route = createFileRoute('/manga/$mangaId')({
  loader: async ({ context, params }) => {
    if (!isInteger(params.mangaId)) {
      throw notFound();
    }

    const mangaId = Number.parseInt(params.mangaId);

    const [mangaData, userFollows] = await Promise.all([
      getFullMangaFn(context.queryClient, mangaId),
      getUserFollowsFn({ data: mangaId }),
    ]);

    return {
      mangaData,
      userFollows,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};

    const { manga } = loaderData.mangaData;

    return {
      meta: defineMeta({
        title: 'Follows',
        openGraph: {
          title: manga.title,
          images: manga.cover
            ? [{
              url: manga.cover,
              alt: `${manga.title} cover art`,
            }]
            : undefined,
        },
      }),
    };
  },
  component: MangaPage,
});


function MangaPage() {
  const {
    mangaData,
    userFollows,
  } = Route.useLoaderData();


  return <Manga mangaData={mangaData} userFollows={userFollows} />;
}

