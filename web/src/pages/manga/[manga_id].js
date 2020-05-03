import Manga from '../../views/Manga';
import React from "react";
import fetch from 'node-fetch'


const host = process.env.HOST || 'http://localhost:3000';

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
    const response = await fetch(`${host}/api/manga/${ctx.params.manga_id}?chapters=50`);
    const data = await response.json();
    if (data.error) {
        ctx.res.redirect('/404');
        return {props: {}};
    }

    return {
        props: {
            manga: {
              ...data
            },
            follows: ctx.req.user_follows || null,
        }
    }
}
export default MangaPage;