import { NextSeo } from 'next-seo';

import type { GetServerSidePropsExpress } from '@/types/nextjs';
import MergeManga from '@/views/MergeManga';
import withError from '@/webUtils/withError';

type PageProps = { error?: number };

export const getServerSideProps: GetServerSidePropsExpress<PageProps> = async ({ req }) => {
  if (!(req.user && req.user.admin)) {
    return { props: { error: 404 }};
  }

  return {
    props: {},
  };
};

const MergeView = withError<PageProps>(MergeManga);
const MergeMangaPage = (props: PageProps) => (
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
