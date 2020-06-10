import Follows from '../views/Follows';
import React from "react";
import withError from "./../utils/withError";

const MangaPage = function (props) {
  const {
    follows,
  } = props

  return <Follows follows={follows}/>;
}


export async function getServerSideProps({ req, res }) {
  const { getFollows } = require('./../../db/manga');
  let error;
  let follows;
  try {
    follows = await getFollows(req.user?.user_id);
  } catch (e) {
    error = e;
  }

  if (!follows || error) {
    return {props: {error: error?.status || 404}};
  }

  return {
    props: {
      follows: follows
    }
  }
}
export default withError(MangaPage);