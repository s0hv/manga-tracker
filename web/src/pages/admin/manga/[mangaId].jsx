import { ConfirmProvider } from 'material-ui-confirm';
import { NextSeo } from 'next-seo';
import React from 'react';
import withError from '../../../utils/withError';
import Manga from '../../../views/admin/MangaAdmin';
import { jsonSerializable } from '../../../utils/utilities';

import { getFullManga } from '../../../../db/manga';
import { getServiceConfigs } from '../../../../db/services';

function MangaPage(props) {
  const {
    manga,
    serviceConfigs,
  } = props;

  return (
    <>
      <NextSeo
        title={manga.title}
        nofollow
        noindex
      />
      <ConfirmProvider>
        <Manga mangaData={{ ...manga }} serviceConfigs={serviceConfigs} />
      </ConfirmProvider>
    </>
  );
}

export async function getServerSideProps({ req, params }) {
  if (!(req.user && req.user.admin)) {
    return { props: { error: 404 }};
  }

  let manga;
  try {
    manga = await getFullManga(params.mangaId);
    if (!manga) {
      return { props: { error: 404 }};
    }
  } catch (e) {
    return { props: { error: e?.status || 404 }};
  }

  if (!manga) {
    return { props: { error: 404 }};
  }
  const data = jsonSerializable(manga);
  const serviceConfigs = jsonSerializable(await getServiceConfigs());

  return {
    props: {
      manga: data,
      serviceConfigs,
    },
  };
}
export default withError(MangaPage);
