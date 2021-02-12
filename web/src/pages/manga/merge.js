import { NextSeo } from 'next-seo';
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

const MergeView = withError(MergeManga);
const MergeMangaPage = (props) => (
  <>
    <NextSeo
      title='Merge manga'
      nofollow
      noindex
    />
    <MergeView {...props} />
  </>
);

export default MergeMangaPage;
