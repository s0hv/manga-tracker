/* eslint-disable global-require,camelcase */
import React from 'react';
import withError from '../utils/withError';
import Follows from '../views/Follows';

const MangaPage = function MangaPage(props) {
  const {
    follows,
  } = props;

  return <Follows follows={follows} />;
};


export async function getServerSideProps({ req }) {
  const { getFollows } = require('../../db/manga');
  let error;
  let follows;
  try {
    follows = await getFollows(req.user?.user_id);
  } catch (e) {
    error = e;
  }

  if (!follows || error) {
    return { props: { error: error?.status || 404 }};
  }

  return {
    props: {
      follows: follows,
    },
  };
}
export default withError(MangaPage);
