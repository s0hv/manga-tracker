import { responsiveFontSizes, createMuiTheme } from '@material-ui/core/styles';
import { blue } from '@material-ui/core/colors';

export const getTheme = (prefersDark) => responsiveFontSizes(createMuiTheme({
  palette: {
    type: prefersDark ? 'dark' : 'light',
    primary: blue,
    background: {
      default: prefersDark ? '#282c34' : '#FFFFFF',
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
}));
