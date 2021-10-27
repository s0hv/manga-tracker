import { Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import React from 'react';
import PropTypes from 'prop-types';

import {
  defaultDateDistanceToNow,
  defaultDateFormat,
  statusToString,
} from '../utils/utilities';

const DetailText = styled(Typography)(({ theme }) => ({
  marginLeft: '5px',
  [theme.breakpoints.down('md')]: {
    marginLeft: '3px',
  },
}));

const InfoTable = styled('table')(({ theme }) => ({
  width: 'max-content',
  borderSpacing: '0px 2px',
  margin: theme.spacing(1),
  '& tr:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
  '& th': {
    textAlign: 'end',
    paddingLeft: '2px',
  },
  '& td': {
    paddingRight: '4px',
  },
}));


const MangaInfo = ({ mangaData, showId = false }) => {
  const latestRelease = mangaData.latestRelease ?
    new Date(mangaData.latestRelease) :
    null;
  const estimatedRelease = new Date(mangaData.estimatedRelease);

  return (
    <InfoTable aria-label='manga information'>
      <tbody>
        {showId && (
          <tr>
            <th scope='row'><Typography>Manga id:</Typography></th>
            <td><DetailText>{mangaData.mangaId}</DetailText></td>
          </tr>
        )}
        <tr>
          <th scope='row'><Typography>Latest release:</Typography></th>
          <td>
            <DetailText>
              {latestRelease ?
                defaultDateFormat(latestRelease) + ' - ' + defaultDateDistanceToNow(latestRelease) :
                'Unknown'}
            </DetailText>
          </td>
        </tr>
        <tr>
          <th scope='row'><Typography>Estimated release interval:</Typography></th>
          <td>
            <DetailText>
              {(mangaData.releaseInterval ?
                `${mangaData.releaseInterval?.days || 0} days ${mangaData.releaseInterval?.hours || 0} hours` :
                'Unknown')}
            </DetailText>
          </td>
        </tr>
        <tr>
          <th scope='row'><Typography>Estimated next release:</Typography></th>
          <td>
            <DetailText>
              {defaultDateFormat(estimatedRelease)}
            </DetailText>
          </td>
        </tr>
        <tr>
          <th scope='row'><Typography>Latest chapter:</Typography></th>
          <td>
            <DetailText>
              {mangaData.latestChapter ? mangaData.latestChapter : 'Unknown'}
            </DetailText>
          </td>
        </tr>
        <tr>
          <th scope='row'><Typography>Publication status:</Typography></th>
          <td>
            <DetailText>
              {statusToString(mangaData.status)}
            </DetailText>
          </td>
        </tr>
      </tbody>
    </InfoTable>
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
