import React, { FunctionComponent, useCallback, useMemo } from 'react';
import { Button, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import { type SubmitHandler, useForm } from 'react-hook-form';
import { SelectElement } from 'react-hook-form-mui';

import { MangaStatus } from '@/common/mangaStatus';
import type { MangaData, MangaInfoData } from '@/types/api/manga';

import { updateMangaInfo } from '../api/admin/manga';
import { asNumber } from '../utils/formUtils';
import {
  defaultDateDistanceToNow,
  defaultDateFormat,
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
  mangaData: MangaData & Pick<MangaInfoData, 'status'>;
};

interface FormData {
  status: MangaStatus;
}

const statusOptions = Object.values(MangaStatus)
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
      .catch((err: unknown) => enqueueSnackbar(`Failed to update manga info. ${String(err)}`, { variant: 'error' }));
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
                ? `${mangaData.releaseInterval?.days ?? 0} days ${mangaData.releaseInterval?.hours ?? 0} hours`
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
              {mangaData.latestChapter ?? 'Unknown'}
            </DetailText>
          </td>
        </tr>

        <tr>
          <th scope='row'>
            <Typography>
              <span id='status-label'>Publication status</span>
              :
            </Typography>
          </th>
          <td>
            <SelectElement
              name='status'
              slotProps={{
                select: {
                  inputProps: {
                    'aria-label': 'publication status',
                  },
                },
              }}
              fullWidth
              variant='standard'
              transform={{
                output: e => asNumber(e.target.value) as MangaStatus,
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
