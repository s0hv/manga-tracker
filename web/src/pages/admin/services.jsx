import { NextSeo } from 'next-seo';

import withError from '../../utils/withError';
import Services from '../../views/admin/Services';

import { getServices } from '../../../server/db/services/serviceInfo';
import {
  DefaultLocalizationProvider,
} from '../../components/DefaultLocalizationProvider';

export async function getServerSideProps({ req }) {
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
        error: err?.status || 404,
      },
    };
  }

  return {
    props: {
      services: rows,
    },
  };
}

const ServicesView = withError(Services);
const ServicesPage = (props) => (
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
