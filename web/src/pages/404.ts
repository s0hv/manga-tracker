import type { GetStaticPropsResult } from 'next';

import NotFound from '../views/NotFound';

export default NotFound;

export async function getStaticProps(): Promise<GetStaticPropsResult<{ username: string }>> {
  return {
    props: { username: '' }, // will be passed to the page component as props
  };
}
