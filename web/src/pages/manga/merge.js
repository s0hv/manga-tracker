import MergeManga from '../../views/MergeManga';
import React from "react";
import withError from "./../../utils/withError";

const MergeMangaPage = function () {
    return <MergeManga />;
}

export async function getServerSideProps( { req } ) {
    if (!(req.user && req.user.admin)) {
        return {props: {error: 404}};
    }

    return {
        props: {}
    }
}
export default withError(MergeMangaPage);