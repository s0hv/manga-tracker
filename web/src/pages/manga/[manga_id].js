import Manga from '../../views/Manga';
import React from "react";
import withError from "./../../utils/withError";

const MangaPage = function (props) {
    const {
        manga,
        follows,
        isAuthenticated = false,
    } = props

    return <Manga mangaData={{...manga}} isAuthenticated={isAuthenticated} userFollows={follows}/>;
}

export async function getServerSideProps({req, params}) {
    const { getManga } = require('./../../../db/manga');
    const { getUserFollows } = require('./../../../db/db');
    let manga, error, userFollows;
    try {
        manga = await getManga(params.manga_id, 50);
        if (req.user?.user_id) {
            userFollows = (await getUserFollows(req.user.user_id, params?.manga_id)).
              rows.map(service => service.service_id);
        }
    } catch (e) {
        error = e;
    }

    if (!manga || error) {
        return {props: {error: error?.status || 404}};
    }
    let data = JSON.parse(JSON.stringify(manga));

    return {
        props: {
            manga: data,
            follows: userFollows || [],
        }
    }
}
export default withError(MangaPage);