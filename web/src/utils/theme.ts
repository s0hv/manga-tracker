import { blue } from '@mui/material/colors';
import { createTheme, responsiveFontSizes } from '@mui/material/styles';
import type {} from '@mui/material/themeCssVarsAugmentation';

export const theme = responsiveFontSizes(createTheme({
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
  cssVariables: {
    colorSchemeSelector: 'class',
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
    fontFamily: "'Roboto Variable', 'Helvetica', 'Arial', 'sans-serif'",
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
