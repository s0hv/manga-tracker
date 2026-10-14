import { useMemo } from 'react';

const MANGADEX_COVER_HOST = 'uploads.mangadex.org';

export const useCoverUrl = (url: string | null | undefined, size: 256 | 512) => {
  return useMemo(() => {
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
};
