import React, { type FC } from 'react';
import { Box, Typography } from '@mui/material';

import { MangaCover } from '@/components/MangaCover';
import type { DatabaseId } from '@/types/dbTypes';

import { ChapterGroupBase } from './ChapterGroupBase';
import { CSS_VARS } from './constants';
import type { GroupComponentProps } from './types';

type ChapterGroupWithCoverProps = GroupComponentProps<{ mangaToCover: Record<DatabaseId, string> }>;

export const ChapterGroupWithCover: FC<ChapterGroupWithCoverProps> = ({
  mangaId,
  group,
  groupString,
  groupItems,
  children,
  mangaToCover,
}) => (
  <ChapterGroupBase>
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gridTemplateRows: 'auto 1fr',
        pb: 2,
      }}
    >
      <Box
        component='a'
        href={`/manga/${mangaId}`}
        target='_blank'
        rel='noopener noreferrer'
        sx={{
          gridRow: {
            xs: undefined,
            sm: 'span 2',
          },
        }}
      >
        <MangaCover
          url={mangaToCover[group]}
          alt={groupString as string}
          minWidth='96px'
          maxWidth={128}
        />
      </Box>

      <Box
        sx={{
          ml: `var(${CSS_VARS.chapterListContentPadding})`,
          mb: '1rem',
          display: 'flex',
          alignItems: 'baseline',
          gap: {
            xs: 1,
            sm: '1rem',
          },
          flexFlow: {
            xs: 'column',
            sm: 'row',
          },
        }}
      >
        <Typography variant='h6'>
          {groupString}
        </Typography>

        <Typography
          variant='body2'
          color='textSecondary'
        >
          {groupItems.length} chapters
        </Typography>
      </Box>

      <Box
        sx={{
          width: '100%',
          gridColumn: {
            xs: 'span 2',
            sm: 'span 1',
          },
        }}
      >
        {children}
      </Box>
    </Box>
  </ChapterGroupBase>
);
