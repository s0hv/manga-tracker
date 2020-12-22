const mock = jest.fn(
  (props) => {
    const Link = jest.requireActual('next/link').default;
    return  Link({...props, prefetch: false});
  }
);
mock.displayName = 'Link'

module.exports = mock;
