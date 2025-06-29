import type { FC, PropsWithChildren } from 'react';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { enGB } from 'date-fns/locale';


export const DefaultLocalizationProvider: FC<PropsWithChildren> = ({ children }) => (
  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
    {children}
  </LocalizationProvider>
);
