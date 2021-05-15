import { RedocStandalone } from 'redoc';

export default function Swagger({ spec }) {
  return <RedocStandalone spec={spec} />;
}

export async function getStaticProps() {
  return {
    props: {
      spec: await require('../../swagger').getOpenapiSpecification(),
      independent: true,
    },
  };
}
