import React from 'react';
import NotFound from '../views/NotFound';


export default function withError(Component) {
  // eslint-disable-next-line react/display-name
  return (props) => {
    const {
      error,
    } = props;

    if (error) {
      return <NotFound />;
    }

    return <Component {...props} />;
  };
}
