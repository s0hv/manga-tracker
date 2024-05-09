import { NextSeo } from 'next-seo';
import React from 'react';

import { getUserFollows } from '@/db/db';
import { getFullManga } from '@/db/manga';
import type { FullMangaData } from '@/types/api/manga.js';
import type { GetServerSidePropsExpress } from '@/types/nextjs';
import { isInteger } from '@/webUtils/utilities';
import Manga from '../../components/Manga';
import withError from '../../utils/withError';

function MangaPage(props: { manga: FullMangaData, follows: number[] }) {
  const {
    manga: fullManga,
    follows,
  } = props;

  const manga = fullManga.manga;

  return (
    <>
      <NextSeo
        title={manga.title}
        openGraph={{
          title: manga.title,
          images: manga.cover ? [{
            url: manga.cover,
            alt: `${manga.title} cover art`,
          }] : undefined,
        }}
      />
      <Manga mangaData={{ ...fullManga }} userFollows={follows as any} />
    </>
  );
}

export const getServerSideProps: GetServerSidePropsExpress = async ({ req, params }) => {
  if (!params || !isInteger(params.mangaId)) {
    return { props: { error: 404 }};
  }

  let manga;
  let userFollows;
  try {
    manga = await getFullManga(params.mangaId);
    if (!manga) {
      return { props: { error: 404 }};
    }

    if (req.user?.userId) {
      userFollows = (await getUserFollows(req.user.userId, params?.mangaId))
        .map(service => service.serviceId);
    }
  } catch (e) {
    return { props: { error: (e as any)?.status || 404 }};
  }

  if (!manga) {
    return { props: { error: 404 }};
  }

  const data = JSON.parse(JSON.stringify(manga));

  return {
    props: {
      manga: data,
      follows: userFollows || [],
    },
  };
};
export default withError(MangaPage);
