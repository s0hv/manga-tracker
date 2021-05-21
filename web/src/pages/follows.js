import React from 'react';
import { NextSeo } from 'next-seo';

import withError from '../utils/withError';
import Follows from '../views/Follows';
import { jsonSerializable } from '../utils/utilities';

const MangaPage = function MangaPage(props) {
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


export async function getServerSideProps({ req }) {
  const { getFollows } = require('../../db/manga');
  let error;
  let follows;
  try {
    follows = await getFollows(req.user?.userId);
  } catch (e) {
    error = e;
  }

  if (!follows || error) {
    return { props: { error: error?.status || 404 }};
  }

  return {
    props: {
      follows: jsonSerializable(follows),
    },
  };
}
export default withError(MangaPage);
