/* eslint-disable global-require,camelcase */
import { ConfirmProvider } from 'material-ui-confirm';
import React from 'react';
import Manga from '../../../views/admin/MangaAdmin';
import withError from '../../../utils/withError';

function MangaPage(props) {
  const {
    manga,
  } = props;

  return (
    <ConfirmProvider>
      <Manga mangaData={{ ...manga }} />
    </ConfirmProvider>
  );
}

export async function getServerSideProps({ req, params }) {
  if (!(req.user && req.user.admin)) {
    return { props: { error: 404 }};
  }

  const { getManga } = require('../../../../db/manga');

  let manga;
  let userFollows;
  try {
    manga = await getManga(params.manga_id);
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
