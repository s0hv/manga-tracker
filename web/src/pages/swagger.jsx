// import { RedocStandalone } from 'redoc';
import { getOpenapiSpecification } from '../../swagger';

// eslint-disable-next-line no-unused-vars
export default function Swagger({ spec }) {
  return <div>Page temporarily disabled</div>;
  // return <RedocStandalone spec={spec} />;
}

export async function getStaticProps() {
  return {
    props: {
      spec: await getOpenapiSpecification(),
      independent: true,
    },
  };
}
