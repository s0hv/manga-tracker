import NProgress from 'nprogress';
import Router from 'next/router';

import { useTheme } from '@mui/material/styles';
import { Global } from '@emotion/react';
import { useEffect } from 'react';

// Based on this
// https://github.com/freddydumont/next-nprogress-emotion/blob/master/src/index.tsx

const ProgressBar = (options) => {
  const theme = useTheme();

  useEffect(() => {
    // Display a progress bar between route transitions
    NProgress.configure(options);

    Router.onRouteChangeStart = () => {
      NProgress.start();
    };

    Router.onRouteChangeComplete = () => {
      NProgress.done();
    };

    Router.onRouteChangeError = () => {
      NProgress.done();
    };
  }, [options]);

  return (
    <Global
      styles={{
        '#nprogress': {
          pointerEvents: 'none',
          '& .bar': {
            position: 'fixed',
            background: theme.palette.common.white,
            borderRadius: 1,
            zIndex: theme.zIndex.tooltip,
            top: 0,
            left: 0,
            width: '100%',
            height: 2,
          },
          '& dd, & dt': {
            position: 'absolute',
            top: 0,
            height: 2,
            boxShadow: `${theme.palette.common.white} 1px 0 6px 1px`,
            borderRadius: '100%',
            animation: 'nprogress-pulse 2s ease-out 0s infinite',
          },
          '& dd': {
            opacity: 0.6,
            width: 20,
            right: 0,
            clip: 'rect(-6px,22px,14px,10px)',
          },
          '& dt': {
            opacity: 0.6,
            width: 180,
            right: -80,
            clip: 'rect(-6px,90px,14px,-6px)',
          },
        },
        '@keyframes nprogress-pulse': {
          '30%': {
            opacity: 0.6,
          },
          '60%': {
            opacity: 0,
          },
          to: {
            opacity: 0.6,
          },
        },
      }}
    />
  );
};

export default ProgressBar;
