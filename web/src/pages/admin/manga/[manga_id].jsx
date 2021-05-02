import { ConfirmProvider } from 'material-ui-confirm';
import { NextSeo } from 'next-seo';
import React from 'react';
import withError from '../../../utils/withError';
import Manga from '../../../views/admin/MangaAdmin';

function MangaPage(props) {
  const {
    manga,
  } = props;

  return (
    <>
      <NextSeo
        title={manga.title}
        nofollow
        noindex
      />
      <ConfirmProvider>
        <Manga mangaData={{ ...manga }} />
      </ConfirmProvider>
    </>
  );
}

export async function getServerSideProps({ req, params }) {
  if (!(req.user && req.user.admin)) {
    return { props: { error: 404 }};
  }

  const { getFullManga } = require('../../../../db/manga');

  let manga;
  let userFollows;
  try {
    manga = await getFullManga(params.manga_id);
    if (!manga) {
      return { props: { error: 404 }};
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
