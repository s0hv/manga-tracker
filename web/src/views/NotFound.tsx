import React from 'react';
import { Box, Typography } from '@mui/material';


export default function NotFound() {
  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '300px',
      width: '100%',
    }}
    >
      <Typography component='h1' variant='h1' sx={{ textAlign: 'center', color: 'text.primary', alignItems: 'center' }}>
        404 Not found
      </Typography>
    </Box>
  );
}
