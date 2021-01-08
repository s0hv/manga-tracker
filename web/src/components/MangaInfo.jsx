import { Tooltip, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import React from 'react';
import PropTypes from 'prop-types';

import {
  defaultDateDistanceToNow,
  defaultDateFormat,
  statusToString,
} from '../utils/utilities';

const useStyles = makeStyles((theme) => ({
  detailText: {
    marginLeft: '5px',
    [theme.breakpoints.down('sm')]: {
      marginLeft: '3px',
    },
  },
  infoTable: {
    margin: theme.spacing(1),
    '& tr:nth-child(odd)': {
      backgroundColor: theme.palette.action.hover,
    },
  },
}));


const MangaInfo = ({ mangaData }) => {
  const latestRelease = mangaData.latest_release ?
    new Date(mangaData.latest_release) :
    null;
  const estimatedRelease = new Date(mangaData.estimated_release);


  const classes = useStyles();
  return (
    <table className={classes.infoTable}>
      <tbody>
        <tr>
          <td><Typography>Latest release:</Typography></td>
          <td>
            <Tooltip title={latestRelease ? latestRelease.toUTCString() : 'Unknown'}>
              <Typography className={classes.detailText}>
                {latestRelease ?
                  defaultDateFormat(latestRelease) + ' - ' + defaultDateDistanceToNow(latestRelease) :
                  'Unknown'}
              </Typography>
            </Tooltip>
          </td>
        </tr>
        <tr>
          <td><Typography>Estimated release interval:</Typography></td>
          <td>
            <Typography className={classes.detailText}>
              {(mangaData.release_interval ?
                `${mangaData.release_interval?.days || 0} days ${mangaData.release_interval?.hours || 0} hours` :
                'Unknown')}
            </Typography>
          </td>
        </tr>
        <tr>
          <td><Typography>Estimated next release:</Typography></td>
          <td>
            <Typography className={classes.detailText}>
              {defaultDateFormat(estimatedRelease)}
            </Typography>
          </td>
        </tr>
        <tr>
          <td><Typography>Latest chapter:</Typography></td>
          <td>
            <Typography className={classes.detailText}>
              {mangaData.latest_chapter ? mangaData.latest_chapter : 'Unknown'}
            </Typography>
          </td>
        </tr>
        <tr>
          <td><Typography>Publication status:</Typography></td>
          <td>
            <Typography className={classes.detailText}>
              {statusToString(mangaData.status)}
            </Typography>
          </td>
        </tr>
      </tbody>
    </table>
  );
};

MangaInfo.propTypes = {
  mangaData: PropTypes.shape({
    latest_release: PropTypes.string,
    estimated_release: PropTypes.string,
    release_interval: PropTypes.object,
    latest_chapter: PropTypes.number,
    status: PropTypes.number,
  }).isRequired,
};

export default MangaInfo;
