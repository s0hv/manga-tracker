import MergeManga from '../../views/MergeManga';
import React from "react";
import withError from "./../../utils/withError";

const MergeMangaPage = function () {
    return <MergeManga />;
}

export async function getServerSideProps(ctx) {
    if (!(ctx.req.user && ctx.req.user.user_id === 1)) {
        return {props: {error: 404}};
    }

    return {
        props: {}
    }
}
export default withError(MergeMangaPage);