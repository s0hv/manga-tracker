import React, { useMemo } from 'react';
import ReactFrappeChart from 'react-frappe-charts';
import { makeStyles } from '@material-ui/core/styles';
import { Typography } from '@material-ui/core';
import { groupByYear } from '../utils/utilities';

const useStyles = makeStyles((theme) => ({
  root: {
    minHeight: '213px',
  },
  yearContainer: {
    display: 'flex',
    flexFlow: 'column',
    textAlign: 'center',
    width: 'min-content',
    maxWidth: '100vw',
    '& > div': {
      overflow: 'auto',
    },
  },
  yearPadding: {
    marginTop: theme.spacing(2),
  },
  '@global': {
    '.domain-name, .subdomain-name': {
      fill: theme.palette.text.secondary,
    },
  },
}));


const ReleaseHeatmap = (props) => {
  const {
    title = 'Release frequency',
    id = 'release-heatmap',
    dataRows,
  } = props;

  const classes = useStyles();

  const dataGrouped = useMemo(() => groupByYear(dataRows), [dataRows]);


  return (
    <div id={id} className={classes.root}>
      <Typography>{title}</Typography>
      <div className={classes.yearContainer}>
        {Object.keys(dataGrouped).sort().reverse().map(year => (
          <React.Fragment key={year}>
            <Typography className={classes.yearPadding}>
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
      </div>
    </div>
  );
};

export default ReleaseHeatmap;
