import React, {
  type DetailedHTMLProps,
  type FC,
  type ImgHTMLAttributes,
  useMemo,
} from 'react';

const MANGADEX_COVER_HOST = 'uploads.mangadex.org';

export interface MangaCoverProps extends DetailedHTMLProps<ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement> {
  url: string | null | undefined
  alt: string
  size?: number
  maxWidth?: number
}

export const MangaCover: FC<MangaCoverProps> = ({
  url,
  alt,
  size = 256,
  maxWidth = size,
  ...props
}) => {
  const actualUrl = useMemo(() => {
    if (!url) return;

    const parsedUrl = new URL(url);

    // If the cover is hosted somewhere else, just use that url
    if (parsedUrl.host !== MANGADEX_COVER_HOST) {
      return url;
    }

    const pathname = parsedUrl.pathname;
    const [_, __, mangaId, coverId] = pathname.split('/');

    const sizeParam = size
      ? `?size=${size}`
      : '';

    return `/thumbnails/mangadex/${mangaId}/${coverId}${sizeParam}`;
  }, [size, url]);

  if (!actualUrl) return null;

  return (
    <img
      style={{
        maxWidth: `${maxWidth}px`,
        minWidth: '100%',
        // Force automatic height after loading the image
        height: 'auto',
        objectFit: 'contain',
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
