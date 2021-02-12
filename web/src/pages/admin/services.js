import { NextSeo } from 'next-seo';
import Services from '../../views/admin/Services';

import withError from '../../utils/withError';

export async function getServerSideProps({ req }) {
  if (!(req.user && req.user.admin)) {
    return { props: { error: 404 }};
  }

  const { getServices } = require('../../../db/services/serviceInfo');
  let rows;

  try {
    rows = await getServices();
    if (rows) {
      rows = JSON.parse(JSON.stringify(rows.rows));
    }
  } catch (err) {
    console.error(err);
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
    <ServicesView {...props} />
  </>
);

export default ServicesPage;
