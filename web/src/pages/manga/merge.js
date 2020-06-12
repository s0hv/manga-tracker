import MergeManga from '../../views/MergeManga';
import withError from '../../utils/withError';

export async function getServerSideProps({ req }) {
    if (!(req.user && req.user.admin)) {
        return { props: { error: 404 }};
    }

    return {
        props: {},
    };
}
export default withError(MergeManga);
