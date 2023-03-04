import React from 'react';
import { Paper, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const Root = styled(Paper)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: theme.vars.palette.background.paper,
  minHeight: '100vh',
  verticalAlign: 'center',
}));

export default function NotFound() {
  return (
    <Root square>
      <Typography component='h1' variant='h1' sx={{ textAlign: 'center', color: 'text.primary', alignItems: 'center' }}>
        404 Not found
      </Typography>
    </Root>
  );
}
