import React, { type FC, type ReactNode, useMemo } from 'react';
import { Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ReactFrappeChart from 'react-frappe-charts';

import type { ChapterReleaseDates } from '@/types/api/chapter';

import { type GroupedYear, groupByYear } from '../utils/utilities';

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

export type ReleaseHeatmapProps = {
  title?: ReactNode
  id?: string
  dataRows: ChapterReleaseDates[] | undefined
};
const ReleaseHeatmap: FC<ReleaseHeatmapProps> = props => {
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
              {`${year} (${(dataGrouped[year] as GroupedYear).total ?? 'no'} releases)`}
            </Typography>
            {!(dataGrouped[year] as { empty: true }).empty && (
              <ReactFrappeChart
                data={dataGrouped[year] as GroupedYear}
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
