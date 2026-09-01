import React from 'react';
import { Box, Skeleton } from '@mui/material';

import { ChapterGroupBase } from './ChapterGroupBase';

export const ChapterGroupLoading = ({ chapterRowGap }: { chapterRowGap: string }) => (
  <ChapterGroupBase>
    <Box
      sx={{
        display: 'grid',
        mb: 1,
        gridTemplateColumns: 'auto 1fr',
        gridTemplateRows: 'auto 1fr',
      }}
    >
      <Skeleton
        width={96}
        height={134}
        variant='rounded'
        sx={{
          mr: 2,
          gridRow: {
            xs: undefined,
            sm: 'span 2',
          },
        }}
      />

      <div>
        <Skeleton height={40} />
        <Skeleton height={20} width='50%' />
      </div>

      <Box
        sx={{
          width: '100%',
          gap: chapterRowGap,
          mt: 1,
          gridColumn: {
            xs: 'span 2',
            sm: 'span 1',
          },
        }}
      >
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </Box>
    </Box>
  </ChapterGroupBase>
);
