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

export async function getServerSideProps(ctx) {
    const manga = ctx.req?.manga_data;
    const error = ctx.req?.error;
    if (!manga || error) {
        return {props: {error: error?.status || 404}};
    }
    let data = JSON.parse(JSON.stringify(manga))

    return {
        props: {
            manga: data,
            follows: ctx.req?.user_follows || null,
        }
    }
}
export default withError(MangaPage);