import { NextSeo } from 'next-seo';

import { DefaultLocalizationProvider } from '@/components/DefaultLocalizationProvider';
import { getServices } from '@/db/services/serviceInfo';
import type { GetServerSidePropsExpress } from '@/types/nextjs';
import Services, { type ServicesProps } from '@/views/admin/Services';
import withError from '@/webUtils/withError';

type PageProps = ServicesProps & { error?: unknown };

export const getServerSideProps: GetServerSidePropsExpress<PageProps> = async ({ req }) => {
  if (!(req.user && req.user.admin)) {
    return { props: { error: 404 }};
  }

  let rows;

  try {
    rows = await getServices();
    if (rows) {
      rows = JSON.parse(JSON.stringify(rows));
    }
  } catch (err) {
    req.log.error(err);
    return {
      props: {
        error: 404,
      },
    };
  }

  return {
    props: {
      services: rows,
    },
  };
};

const ServicesView = withError<PageProps>(Services);
const ServicesPage = (props: PageProps) => (
  <>
    <NextSeo
      title='Services'
      nofollow
      noindex
    />
    <DefaultLocalizationProvider>
      <ServicesView {...props} />
    </DefaultLocalizationProvider>
  </>
);

export default ServicesPage;
