/* eslint-disable react/destructuring-assignment */
import React from 'react';
import {
  createMuiTheme,
  responsiveFontSizes,
  ThemeProvider,
} from '@material-ui/core/styles';
import CssBaseline from '@material-ui/core/CssBaseline';
import {blue} from '@material-ui/core/colors';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import Head from 'next/head';
import Root from '../components/Root';


const sessionDebug = require('debug')('session-debug');


function MainApp({ Component, pageProps, props }) {
  const [theme, setTheme] = React.useState(props.theme);
  // Without doing update after server side styles are removed stuff just doesn't work properly
  // const [update, doUpdate] = React.useState(false);
  // eslint-disable-next-line no-unused-vars
  const [user] = React.useState(props.user);

  function childSetTheme(val) {
    setTheme(val);
  }

  React.useEffect(() => {
    const jssStyles = document.querySelector('#jss-server-side');
    if (jssStyles) {
      jssStyles.parentElement.removeChild(jssStyles);
    }
    // doUpdate(!update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const tempDark = useMediaQuery('(prefers-color-scheme: dark)');
  const prefersDarkMode = theme === 0 ? tempDark : theme === 2;
  props.setTheme = childSetTheme;
  props.activeTheme = prefersDarkMode ? 2 : 1;
  props.user = user;

  const activeTheme = React.useMemo(
    () => responsiveFontSizes(createMuiTheme({
        palette: {
            type: prefersDarkMode ? 'dark' : 'light',
            primary: blue,
          background: {
              default: prefersDarkMode ? '#282c34' : undefined,
          },
        },
      })),
    [prefersDarkMode],
  );

  return (
    <React.Fragment>
      <Head>
        <title>My page</title>
        <meta name='viewport' content='minimum-scale=1, initial-scale=1, width=device-width' />
      </Head>
      <ThemeProvider theme={activeTheme}>
        <CssBaseline />
        <Root Component={Component} pageProps={pageProps} props={props} setTheme={childSetTheme} />
      </ThemeProvider>
    </React.Fragment>
  );
}

MainApp.getInitialProps = async function getInitialProps({ ctx }) {
  if (!ctx.req) {
    return { props: { statusCode: 200 }};
  }
  sessionDebug('Initial props', ctx.req.user);
  const req = ctx.req;
  return {
    props: {
      user: req.user,
      theme: req.user?.theme || req.session?.theme || 0,
      statusCode: ctx.res?.statusCode || 200,
    },
  };
};

export default MainApp;
