import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { enGB } from 'date-fns/locale';
import type { FC, PropsWithChildren } from 'react';

export const DefaultLocalizationProvider: FC<PropsWithChildren> = ({ children }) => (
  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
    {children}
  </LocalizationProvider>
);
