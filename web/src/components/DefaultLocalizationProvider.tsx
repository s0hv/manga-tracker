import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import enLocale from 'date-fns/locale/en-GB';
import type { FC, PropsWithChildren } from 'react';

export const DefaultLocalizationProvider: FC<PropsWithChildren> = ({ children }) => (
   <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enLocale}>
     {children}
   </LocalizationProvider>
)
