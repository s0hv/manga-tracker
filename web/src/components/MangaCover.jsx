import React from 'react';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(() => ({
  thumbnail: {
    maxWidth: '256px',
    minWidth: '100%',
  },
}));

export const MangaCover = ({ url, alt }) => {
  const classes = useStyles();

  if (!url) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${url}.256.jpg`}
      alt={alt}
      className={classes.thumbnail}
      loading='lazy'
      decoding='async'
    />
  );
};
