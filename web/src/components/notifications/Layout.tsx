import {
  Accordion as AccordionMui,
  AccordionDetails,
  AccordionSummary as AccordionSummaryMui,
  Box,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Checkboxes } from 'mui-rff';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { FC, PropsWithChildren } from 'react';


const FlexBox = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
});

const RightSideBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  minWidth: '15%',
  display: 'flex',
  flexFlow: 'column',
  rowGap: '5px',
}));

export const RightSide: FC<PropsWithChildren<{ disabled: boolean }>> = ({ children, disabled }) => (
  <RightSideBox>
    <Checkboxes
      name='disabled'
      color='primary'
      data={{ label: 'Disabled', value: undefined }}
      fieldProps={{ defaultValue: false }}
      disabled={disabled}
    />
    <Checkboxes
      name='groupByManga'
      color='primary'
      data={{ label: 'Group by manga', value: undefined }}
      fieldProps={{ defaultValue: false }}
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
