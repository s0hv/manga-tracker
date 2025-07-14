import React from 'react';

import NotFound from '../views/NotFound';


export default function withError(Component) {
  return props => {
    const {
      error,
    } = props;

    if (error) {
      return <NotFound />;
    }

    return <Component {...props} />;
  };
}
