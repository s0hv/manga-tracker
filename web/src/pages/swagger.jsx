import { RedocStandalone } from 'redoc';
import { getOpenapiSpecification } from '../../swagger';

export default function Swagger({ spec }) {
  return <RedocStandalone spec={spec} />;
}

export async function getStaticProps() {
  return {
    props: {
      spec: await getOpenapiSpecification(),
      independent: true,
    },
  };
}
