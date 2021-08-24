import { Typography } from '@material-ui/core';
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
    width: 'max-content',
    borderSpacing: '0px 2px',
    margin: theme.spacing(1),
    '& tr:nth-child(odd)': {
      backgroundColor: theme.palette.action.hover,
    },
    '& th': {
      textAlign: 'end',
      paddingLeft: '2px',
    },
    '& td': {
      paddingRight: '4px',
    },
  },
}));


const MangaInfo = ({ mangaData, showId = false }) => {
  const latestRelease = mangaData.latestRelease ?
    new Date(mangaData.latestRelease) :
    null;
  const estimatedRelease = new Date(mangaData.estimatedRelease);


  const classes = useStyles();
  return (
    <table className={classes.infoTable} aria-label='manga information'>
      <tbody>
        {showId && (
          <tr>
            <th scope='row'><Typography>Manga id:</Typography></th>
            <td><Typography className={classes.detailText}>{mangaData.mangaId}</Typography></td>
          </tr>
        )}
        <tr>
          <th scope='row'><Typography>Latest release:</Typography></th>
          <td>
            <Typography className={classes.detailText}>
              {latestRelease ?
                defaultDateFormat(latestRelease) + ' - ' + defaultDateDistanceToNow(latestRelease) :
                'Unknown'}
            </Typography>
          </td>
        </tr>
        <tr>
          <th scope='row'><Typography>Estimated release interval:</Typography></th>
          <td>
            <Typography className={classes.detailText}>
              {(mangaData.releaseInterval ?
                `${mangaData.releaseInterval?.days || 0} days ${mangaData.releaseInterval?.hours || 0} hours` :
                'Unknown')}
            </Typography>
          </td>
        </tr>
        <tr>
          <th scope='row'><Typography>Estimated next release:</Typography></th>
          <td>
            <Typography className={classes.detailText}>
              {defaultDateFormat(estimatedRelease)}
            </Typography>
          </td>
        </tr>
        <tr>
          <th scope='row'><Typography>Latest chapter:</Typography></th>
          <td>
            <Typography className={classes.detailText}>
              {mangaData.latestChapter ? mangaData.latestChapter : 'Unknown'}
            </Typography>
          </td>
        </tr>
        <tr>
          <th scope='row'><Typography>Publication status:</Typography></th>
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
    latestRelease: PropTypes.string,
    estimatedRelease: PropTypes.string,
    releaseInterval: PropTypes.object,
    latestChapter: PropTypes.number,
    status: PropTypes.number,
  }).isRequired,
  showId: PropTypes.bool,
};

export default MangaInfo;
