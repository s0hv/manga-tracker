import React, { type FC, type PropsWithChildren } from 'react';
import { Paper } from '@mui/material';

export const ChapterGroupBase: FC<PropsWithChildren> = ({
  children,
}) => (
  <Paper sx={{
    mb: 1,
    p: 2,
    pb: '1px',
  }}
  >
    {children}
  </Paper>
);
