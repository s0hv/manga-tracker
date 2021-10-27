import React, { useMemo } from 'react';
import ReactFrappeChart from 'react-frappe-charts';
import { Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import { groupByYear } from '../utils/utilities';

const Root = styled('div')(({ theme }) => ({
  minHeight: '213px',

  '& .domain-name, & .subdomain-name': {
    fill: theme.palette.text.secondary,
  },
}));

const YearContainer = styled('div')({
  display: 'flex',
  flexFlow: 'column',
  textAlign: 'center',
  width: 'min-content',
  maxWidth: '100vw',
  '& > div': {
    overflow: 'auto',
  },
});

const ReleaseHeatmap = (props) => {
  const {
    title = 'Release frequency',
    id = 'release-heatmap',
    dataRows,
  } = props;

  const dataGrouped = useMemo(() => groupByYear(dataRows), [dataRows]);

  return (
    <Root id={id}>
      <Typography>{title}</Typography>
      <YearContainer>
        {Object.keys(dataGrouped).sort().reverse().map(year => (
          <React.Fragment key={year}>
            <Typography sx={{ mt: 2 }}>
              {`${year} (${dataGrouped[year].total || 'no'} releases)`}
            </Typography>
            {!dataGrouped[year].empty && (
              <ReactFrappeChart
                data={dataGrouped[year]}
                type='heatmap'
              />
            )}
          </React.Fragment>
        ))}
      </YearContainer>
    </Root>
  );
};

export default ReleaseHeatmap;
