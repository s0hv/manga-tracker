import React, {
  type DetailedHTMLProps,
  type FC,
  type ImgHTMLAttributes,
} from 'react';
import { Box, Typography } from '@mui/material';

import { useCoverUrl } from '@/components/MangaCover/useCoverUrl';

export interface MangaCoverProps extends DetailedHTMLProps<ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement> {
  url: string | null | undefined;
  alt: string;
  size?: 256 | 512;
  maxWidth?: number;
  minWidth?: CSSStyleProperties['minWidth'];
  usePlaceholder?: boolean;
}

export const MangaCover: FC<MangaCoverProps> = ({
  url,
  alt,
  size = 256,
  maxWidth = size,
  minWidth = '100%',
  usePlaceholder,
  style,
  ...props
}) => {
  const actualUrl = useCoverUrl(url, size);

  if (!actualUrl) {
    return usePlaceholder
      ? (
        <Box sx={{
          maxWidth: `${maxWidth}px`,
          minWidth,
          objectFit: 'contain',
          alignContent: 'center',
          p: 2,
          borderRadius: '4px',
          backgroundColor: '#EEEEEE',
          ...style,
        }}
        >
          <Typography variant='body1' sx={{ color: '#777777', fontWeight: 500 }}>
            {alt}
          </Typography>
        </Box>
      )
      : null;
  }

  return (
    <Box
      component='img'
      sx={{
        maxWidth: `${maxWidth}px`,
        minWidth,
        // Force automatic height after loading the image
        height: 'auto',
        objectFit: 'contain',
        borderRadius: '4px',
        ...style,
      }}
      src={actualUrl}
      alt={alt}
      width={size}
      // Assume height is double the width for manga covers during loading.
      // The rendered image will adjust to its actual height.
      height={size * 2}
      loading='lazy'
      decoding='async'
      referrerPolicy='no-referrer'
      {...props}
    />
  );
};
