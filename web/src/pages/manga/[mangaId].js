import { NextSeo } from 'next-seo';
import React from 'react';

import Manga from '../../components/Manga';
import withError from '../../utils/withError';

function MangaPage(props) {
  const {
    manga,
    follows,
  } = props;

  return (
    <>
      <NextSeo
        title={manga.title}
        openGraph={{
          title: manga.title,
          images: [{
            url: manga.cover,
            alt: `${manga.title} cover art`,
          }],
        }}
      />
      <Manga mangaData={{ ...manga }} userFollows={follows} />
    </>
  );
}

export async function getServerSideProps({ req, params }) {
  const { getFullManga } = require('../../../db/manga');
  const { getUserFollows } = require('../../../db/db');

  // Log a page view
  require('../../../utils/view-counter/manga-view-counter').mangaView(req.session, params);

  let manga;
  let userFollows;
  try {
    manga = await getFullManga(params.mangaId, 25);
    if (!manga) {
      return { props: { error: 404 }};
    }

    if (req.user?.userId) {
      userFollows = (await getUserFollows(req.user.userId, params?.mangaId))
        .map(service => service.serviceId);
    }
  } catch (e) {
    return { props: { error: e?.status || 404 }};
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
}
export default withError(MangaPage);
