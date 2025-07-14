import React, { type FC } from 'react';
import { styled } from '@mui/material/styles';

const CoverImage = styled('img')({
  minWidth: '100%',
});

export type MangaCoverProps = {
  url: string | null | undefined
  alt: string
  size?: number
  maxWidth?: number
};
export const MangaCover: FC<MangaCoverProps> = ({ url, alt, size = 256, maxWidth = size }) => {
  if (!url) return null;

  return (
    <CoverImage
      style={{ maxWidth: `${maxWidth}px` }}
      src={`${url}.${size}.jpg`}
      alt={alt}
      loading='lazy'
      decoding='async'
      referrerPolicy='no-referrer'
    />
  );
};
