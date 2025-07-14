import React, { FunctionComponent, useCallback, useMemo } from 'react';
import { Button, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import { type SubmitHandler, useForm } from 'react-hook-form';
import { SelectElement } from 'react-hook-form-mui';

import { MangaStatus, PostgresInterval } from '@/types/dbTypes';

import { updateMangaInfo } from '../api/admin/manga';
import { asNumber } from '../utils/formUtils';
import {
  defaultDateDistanceToNow,
  defaultDateFormat,
  enumValues,
  statusToString,
} from '../utils/utilities';

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
    mangaId: number
    latestRelease?: string | null
    estimatedRelease?: string | null
    releaseInterval?: PostgresInterval | null
    latestChapter?: number | null
    status: MangaStatus
  }
};

interface FormData {
  status: MangaStatus
}

const statusOptions = enumValues(MangaStatus)
  .map(value => ({
    value,
    label: statusToString(value),
  }));

const EditableMangaInfo: FunctionComponent<MangaInfoProps> = ({ mangaData }) => {
  const latestRelease = mangaData.latestRelease
    ? new Date(mangaData.latestRelease)
    : null;
  const estimatedRelease = mangaData.estimatedRelease
    ? new Date(mangaData.estimatedRelease)
    : null;
  const { enqueueSnackbar } = useSnackbar();

  const initialData = useMemo<FormData>(() => ({ status: mangaData.status }), [mangaData.status]);

  const {
    control,
    handleSubmit,
  } = useForm<FormData>({
    defaultValues: initialData,
  });

  const updateInfo = useCallback<SubmitHandler<FormData>>(values => {
    updateMangaInfo(mangaData.mangaId, values)
      .then(() => enqueueSnackbar('Manga info updated', { variant: 'success' }))
      .catch(err => enqueueSnackbar(`Failed to update manga info. ${err}`, { variant: 'error' }));
  }, [enqueueSnackbar, mangaData.mangaId]);

  return (
    <InfoTable aria-label='manga information'>
      <tbody>
        <tr>
          <th scope='row'>
            <Typography>Latest release:</Typography>
          </th>
          <td>
            <DetailText>
              {latestRelease
                ? defaultDateFormat(latestRelease) + ' - ' + defaultDateDistanceToNow(latestRelease)
                : 'Unknown'}
            </DetailText>
          </td>
        </tr>

        <tr>
          <th scope='row'>
            <Typography>Estimated release interval:</Typography>
          </th>
          <td>
            <DetailText>
              {(mangaData.releaseInterval
                ? `${mangaData.releaseInterval?.days || 0} days ${mangaData.releaseInterval?.hours || 0} hours`
                : 'Unknown')}
            </DetailText>
          </td>
        </tr>

        <tr>
          <th scope='row'>
            <Typography>Estimated next release:</Typography>
          </th>
          <td>
            <DetailText>
              {defaultDateFormat(estimatedRelease)}
            </DetailText>
          </td>
        </tr>

        <tr>
          <th scope='row'>
            <Typography>Latest chapter:</Typography>
          </th>
          <td>
            <DetailText>
              {mangaData.latestChapter ? mangaData.latestChapter : 'Unknown'}
            </DetailText>
          </td>
        </tr>

        <tr>
          <th scope='row'>
            <Typography>
              <label id='status-label'>Publication status</label>
              :
            </Typography>
          </th>
          <td>
            <SelectElement
              name='status'
              slotProps={{
                select: {
                  labelId: 'status-label',
                },
              }}
              fullWidth
              variant='standard'
              transform={{
                output: e => asNumber(e.target.value),
              }}
              control={control}
              sx={{ ml: 0.5 }}
              options={statusOptions}
              valueKey='value'
            />
          </td>
        </tr>

        <tr>
          <td>
            <Button onClick={handleSubmit(updateInfo)}>Save changes</Button>
          </td>
        </tr>
      </tbody>
    </InfoTable>
  );
};

export default EditableMangaInfo;
