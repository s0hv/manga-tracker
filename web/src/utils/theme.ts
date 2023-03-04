import {
  experimental_extendTheme as extendTheme,
  responsiveFontSizes,
} from '@mui/material/styles';

import { blue } from '@mui/material/colors';
import { Roboto } from '@next/font/google';

export const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  fallback: ['Helvetica', 'Arial', 'sans-serif'],
});

export const theme = responsiveFontSizes(extendTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: blue,
      },
    },

    dark: {
      palette: {
        primary: blue,
      },
    },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
    },
  },
  typography: {
    fontFamily: roboto.style.fontFamily,
  },
}));

export const nextImageFix = {
  // Forced overrides for next image
  '& span': {
    position: 'static !important',
  },
  '& span > img': {
    position: 'static !important',
    width: 'auto !important',
    height: 'auto !important',
  },
};
