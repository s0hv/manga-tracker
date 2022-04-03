import {
  Box,
  AccordionDetails,
  Accordion as AccordionMui,
  AccordionSummary as AccordionSummaryMui,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Checkboxes } from 'mui-rff';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';


const FlexBox = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
});

const RightSideBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  minWidth: '15%',
  display: 'flex',
  flexFlow: 'column',
}));

export const RightSide = ({ children }) => (
  <RightSideBox>
    <Checkboxes
      name='disabled'
      color='primary'
      data={{ label: 'Disabled' }}
      fieldProps={{ defaultValue: false }}
    />
    <Checkboxes
      name='groupByManga'
      color='primary'
      data={{ label: 'Group by manga' }}
      fieldProps={{ defaultValue: false }}
    />
    {children}
  </RightSideBox>
);

export const FlexLayout = ({ children }) => (
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

export const CollapsableLayout = ({ defaultExpanded, children }) => (
  <Accordion disableGutters defaultExpanded={defaultExpanded}>
    <AccordionSummary expandIcon={<ExpandMoreIcon fontSize='large' />} />
    <AccordionDetails>
      {children}
    </AccordionDetails>
  </Accordion>
);

export const NotificationTypeText = ({ children }) => (
  <Typography variant='h6'>{children}</Typography>
);
