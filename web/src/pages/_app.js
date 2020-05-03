import Root from '../components/Root';
import React from "react";
import {createMuiTheme, ThemeProvider} from "@material-ui/core/styles";
import CssBaseline from '@material-ui/core/CssBaseline';
import {blue} from "@material-ui/core/colors";
import useMediaQuery from '@material-ui/core/useMediaQuery';
import Head from 'next/head';


const MyApp = function ({ Component, pageProps, props }) {
  React.useEffect(() => {
    const jssStyles = document.querySelector('#jss-server-side');
    if (jssStyles) {
      jssStyles.parentElement.removeChild(jssStyles);
    }
  }, [])


  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  console.log(prefersDarkMode);

  const theme = React.useMemo(
    () =>
      createMuiTheme({
        palette: {
            type: prefersDarkMode ? 'dark' : 'light',
            primary: blue,
          background: {
              default: '#282c34'
          }
        },
      }),
    [prefersDarkMode],
  );

  return (
    <React.Fragment>
      <Head>
        <title>My page</title>
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width" />
      </Head>
      <ThemeProvider theme={theme}>
          <CssBaseline/>
          <Root Component={Component} pageProps={pageProps} props={props}/>
      </ThemeProvider>
    </React.Fragment>);
}

MyApp.getInitialProps = async function ({ ctx }) {
  console.log('Initial props', ctx.req.user);
  return {
    props: {user: ctx.req.user?.username}, // will be passed to the page component as props
  }
}

export default MyApp;