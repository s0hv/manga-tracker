import React from 'react';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

const Root = styled('div')({
  textAlign: 'center',
  height: '50vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

function App() {
  return (
    <Root>
      <Typography variant='h1'>
        Home page
      </Typography>
    </Root>
  );
}

function MainApp({ user }) {
  return (
    <App user={user} />
  );
}

export default MainApp;
