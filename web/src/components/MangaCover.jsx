import React from 'react';
import { styled } from '@mui/material/styles';

const CoverImage = styled('img')({
  minWidth: '100%',
});

export const MangaCover = ({ url, alt, size = 256, maxWidth = size }) => {
  if (!url) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <CoverImage
      style={{ maxWidth: `${maxWidth}px` }}
      src={`${url}.${size}.jpg`}
      alt={alt}
      loading='lazy'
      decoding='async'
    />
  );
};
