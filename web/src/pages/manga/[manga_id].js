import Manga from '../../views/Manga';
import React from "react";


const MangaPage = function (props) {
    const {
        manga,
        follows,
        isAuthenticated = false,
    } = props

    if (!manga) return null;

    return <Manga mangaData={{...manga}} isAuthenticated={isAuthenticated} userFollows={follows}/>;
}

export async function getServerSideProps(ctx) {
    const manga = ctx.req?.manga_data;
    if (!manga) {
        ctx.res.redirect('/404');
        return {props: {}};
    }
    let data = JSON.parse(JSON.stringify(manga))

    return {
        props: {
            manga: data,
            follows: ctx.req?.user_follows || null,
        }
    }
}
export default MangaPage;