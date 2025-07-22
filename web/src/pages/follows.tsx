import React from 'react';
import { NextSeo } from 'next-seo';

import { getFollows } from '@/db/manga';
import type { Follow } from '@/types/db/follows';
import type { GetServerSidePropsExpress, PageProps } from '@/types/nextjs';
import Follows from '@/views/Follows';
import { jsonSerializable } from '@/webUtils/utilities';
import withError from '@/webUtils/withError';


type Props = PageProps<{ follows?: Follow[] }>;

const MangaPage = (props: Props) => {
  const {
    follows,
  } = props;

  const title = 'Follows';

  return (
    <>
      <NextSeo
        title={title}
        openGraph={{
          title,
        }}
        noindex
        nofollow
      />
      <Follows follows={follows} />
    </>
  );
};


export const getServerSideProps: GetServerSidePropsExpress<Props> = async ({ req }) => {
  let error;
  let follows;
  try {
    follows = await getFollows(req.user?.userId);
  } catch (e) {
    error = e;
  }

  if (!follows || error) {
    return { props: {
      error: (error as { status: number })?.status || 404,
    }};
  }

  return {
    props: {
      follows: jsonSerializable(follows),
    },
  };
};
export default withError(MangaPage);
