import React, { useMemo } from 'react';
import { Box, Button, Container, Typography } from '@mui/material';

import type { ChapterRelease } from '@/types/api/chapter';

import { ChapterGroupLoading } from './ChapterGroupLoading';
import { CSS_VARS } from './constants';
import { GroupChapters } from './GroupChapters';
import type {
  ChapterComponentProps,
  ExtraPropsField,
  GroupComponentProps,
  GroupedChapters,
} from './types';


export type GroupedChapterListProps<
  TGroupExtraProps extends object = object,
  TChapterExtraProps extends object = object
> = {
  groupedChapters: GroupedChapters[]
  groupToString: (mangaId: number, arr: ChapterRelease[]) => string
  onLoadMore?: () => unknown
  isLastPage?: boolean
  GroupComponent: React.ComponentType<GroupComponentProps<TGroupExtraProps>>
  ChapterComponent: React.ComponentType<ChapterComponentProps<TChapterExtraProps>>
  loading?: boolean
  pageSize?: number
  maxShownChaptersPerManga?: number
  chapterRowGap?: string
}
& ExtraPropsField<'groupComponentProps', TGroupExtraProps>
& ExtraPropsField<'chapterComponentProps', TChapterExtraProps>;

export const GroupedChapterList = <
  TGroupExtraProps extends object = object,
  TChapterExtraProps extends object = object
>({
  groupedChapters,
  groupToString = group => group.toString(),
  onLoadMore,
  GroupComponent,
  ChapterComponent,
  loading = false,
  pageSize = 15,
  isLastPage = false,
  maxShownChaptersPerManga = 3,
  groupComponentProps,
  chapterComponentProps,
  chapterRowGap = '8px',
}: GroupedChapterListProps<TGroupExtraProps, TChapterExtraProps>) => {
  const skeletonArray = useMemo(() => {
    return new Array(pageSize).fill(0);
  }, [pageSize]);

  return (
    <Container
      maxWidth='lg'
      disableGutters
      sx={{
        [CSS_VARS.chapterListContentPadding]: '18px',
        [CSS_VARS.chapterRowGap]: chapterRowGap,
      }}
    >
      {loading && pageSize && skeletonArray.map((_, i) => (
        <ChapterGroupLoading key={`${i}`} chapterRowGap={chapterRowGap} />
      ))}

      {!loading && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {groupedChapters.map((group, idx) => {
            const props = {
              ...groupComponentProps,
              groupString: groupToString(group.mangaId, group.chapters),
              group: group.mangaId,
              mangaId: group.mangaId,
              groupItems: group.chapters,
            } as GroupComponentProps<TGroupExtraProps>;

            return (
              <GroupComponent key={`${idx}`} {...props}>
                <GroupChapters<TChapterExtraProps>
                  ChapterComponent={ChapterComponent}
                  chapters={group.chapters}
                  maxShownChapters={maxShownChaptersPerManga}
                  chapterComponentProps={chapterComponentProps}
                />
              </GroupComponent>
            );
          })}

          <Button
            variant='outlined'
            onClick={onLoadMore}
            disabled={isLastPage}
            sx={{
              alignSelf: 'center',
              mt: 2,
              mb: 1,
            }}
          >
            {isLastPage
              ? 'Reached the end'
              : `Load ${pageSize} older chapters`}
          </Button>

          <Typography
            variant='subtitle2'
            color='textSecondary'
            sx={{ alignSelf: 'center' }}
          >
            Chapters from series already listed are added to their card above.
          </Typography>
        </Box>
      )}
    </Container>
  );
};
