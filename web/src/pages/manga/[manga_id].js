/* eslint-disable global-require,camelcase */
import React from 'react';
import Manga from '../../components/Manga';
import withError from '../../utils/withError';

function MangaPage(props) {
  const {
    manga,
    follows,
  } = props;

  return <Manga mangaData={{ ...manga }} userFollows={follows} />;
}

export async function getServerSideProps({ req, params }) {
  const { getManga } = require('../../../db/manga');
  const { getUserFollows } = require('../../../db/db');
  let manga;
  let userFollows;
  try {
    manga = await getManga(params.manga_id, 50);
    if (!manga) {
      return { props: { error: 404 }};
    }

    if (req.user?.user_id) {
      userFollows = (await getUserFollows(req.user.user_id, params?.manga_id))
        .rows.map(service => service.service_id);
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
