import React from 'react';
import { ConfirmProvider } from 'material-ui-confirm';
import { NextSeo } from 'next-seo';

import {
  DefaultLocalizationProvider,
} from '@/components/DefaultLocalizationProvider';
import { getFullManga } from '@/db/manga';
import { getServiceConfigs } from '@/db/services';
import type { FullMangaData } from '@/types/api/manga';
import type { ServiceConfig } from '@/types/api/services';
import type { GetServerSidePropsExpress, PageProps } from '@/types/nextjs';
import Manga from '@/views/admin/MangaAdmin';
import { jsonSerializable } from '@/webUtils/utilities';


import withError from '../../../utils/withError';

type MangaPageProps = PageProps<{
  manga: FullMangaData & { title: string }
  serviceConfigs: ServiceConfig[]
}>;

function MangaPage(props: MangaPageProps) {
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
      <DefaultLocalizationProvider>
        <ConfirmProvider>
          <Manga mangaData={{ ...manga }} serviceConfigs={serviceConfigs} />
        </ConfirmProvider>
      </DefaultLocalizationProvider>
    </>
  );
}

export const getServerSideProps: GetServerSidePropsExpress = async ({ req, params }) => {
  if (!(req.user && req.user.admin)) {
    return { props: { error: 404 }};
  }

  let manga;
  try {
    manga = await getFullManga(params!.mangaId as string);
    if (!manga) {
      return { props: { error: 404 }};
    }
  } catch (e: any) {
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
};
export default withError(MangaPage);
