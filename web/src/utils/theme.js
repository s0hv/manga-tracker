import { responsiveFontSizes, createTheme } from '@mui/material/styles';
import { blue } from '@mui/material/colors';

export const getTheme = (prefersDark) => responsiveFontSizes(createTheme({
  palette: {
    mode: prefersDark ? 'dark' : 'light',
    primary: blue,

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
}));

export const nextImageFix = {
  // Forced overrides for next image
  '& div': {
    position: 'static !important',
  },
  '& div > img': {
    position: 'static !important',
    width: 'auto !important',
    height: 'auto !important',
  },
};
