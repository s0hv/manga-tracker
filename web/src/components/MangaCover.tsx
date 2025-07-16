import React, { type FC } from 'react';
import Image from 'next/image';

export type MangaCoverProps = {
  url: string | null | undefined
  alt: string
  size?: number
  maxWidth?: number
};
export const MangaCover: FC<MangaCoverProps> = ({ url, alt, size = 256, maxWidth = size }) => {
  if (!url) return null;

  return (
    <Image
      style={{
        maxWidth: `${maxWidth}px`,
        minWidth: '100%',
        // Force automatic height after loading the image
        height: 'auto',
        objectFit: 'contain',
      }}
      src={`${url}.${size}.jpg`}
      alt={alt}
      width={size}
      // Assume height is double the width for manga covers during loading.
      // The rendered image will adjust to its actual height.
      height={size * 2}
      loading='lazy'
      decoding='async'
      referrerPolicy='no-referrer'
    />
  );
};
