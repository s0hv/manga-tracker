import NotFound from '../views/NotFound';

export default NotFound;

export async function getStaticProps() {
  return {
    props: { username: '' }, // will be passed to the page component as props
  };
}
