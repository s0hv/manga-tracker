import {
  Accordion as AccordionMui,
  AccordionDetails,
  AccordionSummary as AccordionSummaryMui,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { CheckboxElement } from 'react-hook-form-mui';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { FC, PropsWithChildren } from 'react';
import type { Control } from 'react-hook-form';
import type { FormValues } from '@/components/notifications/types';


const FlexBox = styled('div')({
  display: 'flex',
  justifyContent: 'space-between',
});

const RightSideBox = styled('div')(({ theme }) => ({
  marginTop: theme.spacing(2),
  minWidth: '15%',
  display: 'flex',
  flexFlow: 'column',
  rowGap: '5px',
}));

export const RightSide = <T extends FormValues>({ children, disabled, control }: PropsWithChildren<{ disabled?: boolean, control: Control<T> }>) => (
  <RightSideBox>
    <CheckboxElement
      control={control as unknown as Control<FormValues>}
      name='disabled'
      color='primary'
      label='Disabled'
      value={false}
      disabled={disabled}
    />
    <CheckboxElement
      control={control as unknown as Control<FormValues>}
      name='groupByManga'
      color='primary'
      label='Group by manga'
      value={false}
      disabled={disabled}
    />
    {children}
  </RightSideBox>
);

export const FlexLayout: FC<PropsWithChildren> = ({ children }) => (
  <FlexBox>
    {children}
  </FlexBox>
);

const Accordion = styled(AccordionMui)({
  boxShadow: 'none',
  '&:hover': {
    boxShadow: 'initial',
  },
  '&:before': {
    display: 'none',
  },
  '& .MuiAccordionDetails-root': {
    padding: 0,
  },
});

const AccordionSummary = styled(AccordionSummaryMui)({
  flexDirection: 'row-reverse',
});

export const CollapsableLayout: FC<PropsWithChildren<{ defaultExpanded: boolean }>> = ({ defaultExpanded, children }) => (
  <Accordion disableGutters defaultExpanded={defaultExpanded}>
    <AccordionSummary expandIcon={<ExpandMoreIcon fontSize='large' />} />
    <AccordionDetails>
      {children}
    </AccordionDetails>
  </Accordion>
);

export const NotificationTypeText: FC<PropsWithChildren> = ({ children }) => (
  <Typography variant='h6'>{children}</Typography>
);
