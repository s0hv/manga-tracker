import { type RefCallback, memo } from 'react';
import { Box } from '@mui/material';


import type { SearchedMangaSchema } from '@/common/schemas/manga';

import { MangaForSearch } from './MangaForSearch';

const MAX_WIDTH = 192;

export interface MangaSearchResultsProps {
  mangaResults: SearchedMangaSchema[];
  loadMoreRef: RefCallback<HTMLElement>;
}

export const MangaSearchResults = memo(({
  mangaResults,
  loadMoreRef,
}: MangaSearchResultsProps) => {
  const lastIdx = mangaResults.length - 1;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${MAX_WIDTH}px, 1fr))`,
        gap: 3,
        width: '100%',
        maxWidth: '1280px',
      }}
    >
      {mangaResults.map((manga, idx) => (
        <MangaForSearch
          key={manga.mangaId}
          manga={manga}
          maxWidth={MAX_WIDTH}
          ref={idx === lastIdx ? loadMoreRef : undefined}
        />
      ))}
    </Box>
  );
});
