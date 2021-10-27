import React from 'react';
import { styled } from '@mui/material/styles';

const CoverImage = styled('img')({
  maxWidth: '256px',
  minWidth: '100%',
});

export const MangaCover = ({ url, alt }) => {
  if (!url) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <CoverImage
      src={`${url}.256.jpg`}
      alt={alt}
      loading='lazy'
      decoding='async'
    />
  );
};
