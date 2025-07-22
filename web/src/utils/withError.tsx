import React from 'react';

import NotFound from '../views/NotFound';


export default function withError<TProps extends { error?: unknown }>(Component: React.ComponentType<TProps>) {
  return (props: TProps) => {
    const {
      error,
    } = props;

    if (error) {
      return <NotFound />;
    }

    return <Component {...props} />;
  };
}
