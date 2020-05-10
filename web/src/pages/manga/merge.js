import MergeManga from '../../views/MergeManga';
import React from "react";


const host = process.env.HOST || 'http://localhost:3000';

const MergeMangaPage = function (props) {
    const {
        user,
        isAuthenticated = false,
    } = props

    if (!isAuthenticated) return null;

    return <MergeManga user={{...user}} isAuthenticated={isAuthenticated} />;
}

export async function getServerSideProps(ctx) {
    if (!(ctx.req.user && ctx.req.user.user_id === 1)) {
        ctx.res.redirect('/404');
        return {props: {}};
    }

    return {
        props: {
            user: ctx.req.user,
        }
    }
}
export default MergeMangaPage;