import React from 'react';
import { Divider, Link, Typography, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import GitHubIcon from '@mui/icons-material/GitHub';
import PropTypes from 'prop-types';

import TopBar from './TopBar';


const Root = styled('div')({
  width: '100%',
  overflow: 'auto',
  minWidth: '400px',
  minHeight: '100vh',
  position: 'relative',
});

const FooterContainer = styled('div')(({ theme }) => ({
  paddingTop: theme.spacing(10),
  position: 'sticky',
  left: 0,
  overflow: 'auto',
}));

const FooterStyled = styled('footer')({
  bottom: '0px',
  position: 'absolute',
  width: '100%',
});

const FooterContent = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginLeft: theme.spacing(3),
  marginRight: theme.spacing(3),
}));

function Copyright(props) {
  return (
    <Typography {...props}>
      {'Copyright © '}
      <Link color='inherit' href='https://github.com/s0hv'>
        s0hv
      </Link>
      {' '}
      {new Date().getFullYear()}
      .
    </Typography>
  );
}

export default function Layout(props) {
  const {
    statusCode,
    activeTheme,
    setTheme,
    children,
  } = props;

  if (statusCode !== 200) {
    return children;
  }

  return (
    <Root>
      <TopBar setTheme={setTheme} activeTheme={activeTheme} />
      {children}
      <FooterContainer>
        <FooterStyled>
          <Divider variant='middle' />
          <FooterContent>
            <Copyright />
            <div>
              <Link color='inherit' href='https://github.com/s0hv/manga-tracker/blob/master/LICENSE' aria-label='license'>
                License
              </Link>
              <IconButton
                component='a'
                href='https://github.com/s0hv/manga-tracker'
                aria-label='github repository'
                size='large'
              >
                <GitHubIcon />
              </IconButton>
            </div>
          </FooterContent>
        </FooterStyled>
      </FooterContainer>
    </Root>
  );
}

Layout.propTypes = {
  props: PropTypes.shape({
    statusCode: PropTypes.number,
    activeTheme: PropTypes.number,
    user: PropTypes.object,
    setTheme: PropTypes.func,
    children: PropTypes.elementType,
  }),
};
