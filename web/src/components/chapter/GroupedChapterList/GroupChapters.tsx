import React, { useMemo, useState } from 'react';
import { Box, Button, Stack } from '@mui/material';

import type { ChapterRelease } from '@/types/api/chapter';

import { CSS_VARS } from './constants';
import type { ChapterComponentProps } from './types';

export interface GroupChaptersProps<TChapterExtraProps extends object = object> {
  ChapterComponent: React.ComponentType<ChapterComponentProps<TChapterExtraProps>>
  chapters: ChapterRelease[]
  maxShownChapters: number
  chapterComponentProps?: TChapterExtraProps
}

export const GroupChapters = <TChapterExtraProps extends object = object>({
  ChapterComponent,
  chapters,
  maxShownChapters,
  chapterComponentProps,
}: GroupChaptersProps<TChapterExtraProps>) => {
  const [isAllChaptersShown, setIsAllChaptersShown] = useState(false);
  const hasMoreThanLimit = chapters.length > maxShownChapters;

  const chaptersToShow = useMemo(() => {
    return isAllChaptersShown
      ? chapters
      : chapters.slice(0, maxShownChapters);
  }, [chapters, isAllChaptersShown, maxShownChapters]);

  return (
    <>
      <Stack
        sx={{
          // right margin skipped because the paper component includes some padding
          ml: {
            xs: '0px',
            sm: `var(${CSS_VARS.chapterListContentPadding})`,
          },
          // This is just to limit the page growing too large
          maxHeight: '1000px',
          overflowY: 'auto',
          // Unlike 'flex', grid allows all items to stretch to the same
          // width on narrower screens
          display: 'grid',
        }}
      >
        {chaptersToShow.map(chapter => {
          const props = {
            ...chapterComponentProps,
            chapter,
          } as ChapterComponentProps<TChapterExtraProps>;

          return <ChapterComponent key={chapter.chapterId} {...props} />;
        })}
      </Stack>
      {/* Place the load more button outside the stack so it does not get the
       horizontal overflow on long titles */}
      {hasMoreThanLimit && (
        <Box
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
            ml: {
              xs: '0px',
              sm: `var(${CSS_VARS.chapterListContentPadding})`,
            },
          }}
        >
          <Button
            onClick={() => setIsAllChaptersShown(prev => !prev)}
            sx={{
              width: 'fit-content',
            }}
          >
            {isAllChaptersShown
              ? 'Show fewer'
              : `Show all ${chapters.length} chapters`}
          </Button>
        </Box>
      )}
    </>
  );
};
