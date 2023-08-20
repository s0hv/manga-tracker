import { Button, MenuItem, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import React, { FunctionComponent, useCallback } from 'react';
import { Form } from 'react-final-form';
import { Select } from 'mui-rff';

import { useSnackbar } from 'notistack';
import {
  defaultDateDistanceToNow,
  defaultDateFormat,
  enumValues,
  statusToString,
} from '../utils/utilities';
import { MangaStatus, PostgresInterval } from '@/types/dbTypes';
import { asNumber } from '../utils/formUtils';
import { useCSRF } from '../utils/csrf';
import { updateMangaInfo } from '../api/admin/manga';

const DetailText = styled(Typography)(({ theme }) => ({
  marginLeft: theme.spacing(0.5),
}));

const InfoTable = styled('table')(({ theme }) => ({
  width: 'max-content',
  borderSpacing: '0px 2px',
  margin: theme.spacing(1),
  '& tr:nth-of-type(odd)': {
    backgroundColor: theme.vars.palette.action.hover,
  },
  '& th': {
    textAlign: 'end',
    paddingLeft: '2px',
  },
  '& td': {
    paddingRight: '4px',
  },
}));

export type MangaInfoProps = {
  mangaData: {
    mangaId: number,
    latestRelease?: string | null
    estimatedRelease?: string | null
    releaseInterval?: PostgresInterval | null
    latestChapter?: number | null
    status: MangaStatus
  }
}

interface FormData {
  status: MangaStatus
}


const EditableMangaInfo: FunctionComponent<MangaInfoProps> = ({ mangaData }) => {
  const latestRelease = mangaData.latestRelease ?
    new Date(mangaData.latestRelease) :
    null;
  const estimatedRelease = mangaData.estimatedRelease ?
    new Date(mangaData.estimatedRelease) :
    null;
  const csrf = useCSRF();
  const { enqueueSnackbar } = useSnackbar();

  const updateInfo = useCallback((values: FormData) => {
    updateMangaInfo(csrf, mangaData.mangaId, values)
      .then(() => enqueueSnackbar('Manga info updated', { variant: 'success' }))
      .catch(err => enqueueSnackbar(`Failed to update manga info. ${err}`, { variant: 'error' }));
  }, [csrf, enqueueSnackbar, mangaData.mangaId]);

  return (
    <InfoTable aria-label='manga information'>
      <Form
        onSubmit={updateInfo}
        render={({ handleSubmit }) => (
          <tbody>
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
              <th scope='row'>
                <Typography><label id='status-label'>Publication status</label>:</Typography>
              </th>
              <td>
                <Select
                  name='status'
                  labelId='status-label'
                  variant='standard'
                  fieldProps={{
                    initialValue: mangaData.status,
                    parse: asNumber,
                  }}
                  sx={{ ml: 0.5 }}
                >
                  {enumValues(MangaStatus).map(status => <MenuItem value={status} key={status}>{statusToString(status)}</MenuItem>)}
                </Select>
              </td>
            </tr>
            <tr>
              <td>
                <Button onClick={handleSubmit}>Save changes</Button>
              </td>
            </tr>
          </tbody>
        )}
      />
    </InfoTable>
  );
};

export default EditableMangaInfo;
