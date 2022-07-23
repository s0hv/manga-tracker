import {
  Container,
  Grid,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';

import { styled } from '@mui/material/styles';

import {
  SubdirectoryArrowLeft as SubdirectoryArrowLeftIcon,
} from '@mui/icons-material';
import { useConfirm } from 'material-ui-confirm';
import PropTypes from 'prop-types';

import { Select } from 'mui-rff';
import Link from 'next/link';
import { useSnackbar } from 'notistack';
import React, { useCallback, useMemo, useState } from 'react';
import MangaAliases from '../../components/MangaAliases';
import MangaInfo from '../../components/EditableMangaInfo';


import {
  AddRowFormTemplate,
  EditableSelect,
  MaterialTable,
} from '../../components/MaterialTable';
import { useCSRF } from '../../utils/csrf';
import { getManga } from '../../api/manga';
import {
  createScheduledRun,
  deleteScheduledRun,
  getScheduledRuns,
} from '../../api/admin/manga';
import { MangaCover } from '../../components/MangaCover';
import { FullMangaData } from '../../../types/api/manga';
import { ServiceConfig } from '../../../types/api/services';

const formStyles = {
  minWidth: '150px',
  paddingTop: '0.5em',
};

const TitleBar = styled('div')({
  display: 'flex',
  justifyContent: 'space-between',
});

const MangaTitle = styled(Typography)(({ theme }) => ({
  width: '75%',
  textAlign: 'left',
  paddingBottom: '10px',
  [theme.breakpoints.down('md')]: {
    width: '100%',
  },
}));

const DetailsContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  flexFlow: 'row',
  [theme.breakpoints.down('sm')]: {
    flexFlow: 'wrap',
    justifyContent: 'center',
  },
}));

export type MangaAdminProps = {
  mangaData: FullMangaData,
  serviceConfigs: ServiceConfig[]
}

function MangaAdmin(props: MangaAdminProps) {
  const {
    mangaData: {
      manga,
      services,
      aliases: aliasesProp,
    },
    serviceConfigs,
  } = props;

  // Constants
  const mangaId = manga.mangaId;

  // Hooks
  const { enqueueSnackbar } = useSnackbar();
  const csrf = useCSRF();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(false);
  const [scheduledUpdates, setScheduledUpdates] = useState([]);
  const [aliases, setAliases] = useState(aliasesProp);
  const [mangaTitle, setMangaTitle] = useState(manga.title);

  const formatScheduledRuns = useCallback((runs) => runs.map(run => {
    const found = services.find(s => s.serviceId === run.serviceId);
    if (!found) {
      return run;
    }
    return {
      ...run,
      name: found.name,
    };
  }), [services]);

  const onTitleChange = useCallback(() => {
    getManga(mangaId)
      .then(data => {
        setAliases(data.aliases);
        setMangaTitle(data.manga.title);
      });
  }, [mangaId]);

  // Data fetching callbacks
  const fetchData = useCallback(() => {
    setLoading(true);

    return getScheduledRuns(mangaId)
      .then(data => {
        setScheduledUpdates(formatScheduledRuns(data || []));
      })
      .finally(() => setLoading(false));
  }, [formatScheduledRuns, mangaId]);

  const onCreateRow = useCallback((form) => {
    createScheduledRun(csrf, mangaId, form.serviceId)
      .then(json => {
        setScheduledUpdates(formatScheduledRuns([...scheduledUpdates, json.inserted]));
        enqueueSnackbar(
          `Successfully scheduled manga ${mangaId} to be checked on service ${form.serviceId}`,
          { variant: 'success' }
        );
      })
      .catch(err => enqueueSnackbar(err.message, { variant: 'error' }));
  }, [mangaId, formatScheduledRuns, scheduledUpdates, enqueueSnackbar, csrf]);

  const onDeleteRow = useCallback((row) => {
    const serviceId = row.values.serviceId;
    deleteScheduledRun(csrf, mangaId, serviceId)
      .then(() => {
        setScheduledUpdates(
          formatScheduledRuns(scheduledUpdates.filter(r => r.serviceId !== serviceId))
        );
        enqueueSnackbar(
          `Successfully deleted service ${row.values.name} from scheduled runs`,
          { variant: 'success' }
        );
      })
      .catch(err => enqueueSnackbar(err.message, { variant: 'error' }));
  }, [enqueueSnackbar, formatScheduledRuns, mangaId, scheduledUpdates, csrf]);

  // Table layout
  const fields = useMemo(() => {
    const servicesWithRunsEnabled = new Set(
      serviceConfigs.filter(s => s.scheduledRunsEnabled).map(s => s.serviceId)
    );
    const data = services
      ?.filter(s => servicesWithRunsEnabled.has(s.serviceId))
      .map(s => ({ value: s.serviceId, label: s.name }));

    return [
      <Select
        name='serviceId'
        key='serviceId'
        label='Service'
        SelectDisplayProps={{ 'aria-label': 'Service select' }}
        data={data}
        required
      />,
    ];
  }, [services, serviceConfigs]);

  // The component is memoized with useMemo. I don't see a problem
  // eslint-disable-next-line react/no-unstable-nested-components
  const CreateDialog = useMemo(() => ({ open, onClose }) => (
    <AddRowFormTemplate
      fields={fields}
      onSubmit={onCreateRow}
      onClose={onClose}
      open={open}
      formStyles={formStyles}
    />
  ), [fields, onCreateRow]);

  const columns = useMemo(() => [
    {
      Header: 'Service name',
      accessor: 'name',
      EditCell: ({ row, cell, state }) => (
        <EditableSelect
          value={row.values.serviceId}
          items={services.map(s => ({ value: s.serviceId, text: s.name }))}
          cell={cell}
          row={row}
          state={state}
          onChange={(serviceId) => {
            state.rowEditStates[row.id].serviceId = serviceId;
          }}
        />
      ),
    },
    { Header: 'Service id', accessor: 'serviceId', canEdit: false },
  ], [services]);

  return (
    <Container maxWidth='lg' disableGutters>
      <Paper sx={{ p: '1em', minWidth: '400px' }}>
        <TitleBar>
          <MangaTitle variant='h4'>{mangaTitle}</MangaTitle>
          <Link href={`/manga/${mangaId}`} passHref>
            <Tooltip title='Go back' aria-label='go back to manga page'>
              <IconButton size='large'>
                <SubdirectoryArrowLeftIcon />
              </IconButton>
            </Tooltip>
          </Link>
        </TitleBar>
        <DetailsContainer>
          <a href={manga.mal} target='_blank' rel='noreferrer noopener'>
            <MangaCover
              url={manga.cover}
              alt={manga.title}
            />
          </a>
          <Grid
            container
            direction='column'
            sx={{ ml: { sx: '0px', sm: 4 }, width: 'fit-content' }}
          >
            <MangaInfo mangaData={manga} />
            <MangaAliases
              aliases={aliases}
              mangaId={mangaId}
              onTitleUpdate={onTitleChange}
              enqueueSnackbar={enqueueSnackbar}
              confirm={confirm}
              allowEdits
            />
          </Grid>
        </DetailsContainer>
        <MaterialTable
          data={scheduledUpdates}
          columns={columns}
          editable
          deletable
          creatable
          CreateDialog={CreateDialog}
          title='Scheduled runs'
          fetchData={fetchData}
          onDeleteRow={onDeleteRow}
          loading={loading}
          toolbarProps={{ addButtonLabel: 'add scheduled run' }}
        />
      </Paper>
    </Container>
  );
}

MangaAdmin.propTypes = {
  mangaData: PropTypes.shape({
    manga: PropTypes.object.isRequired,
    services: PropTypes.arrayOf(PropTypes.object),
    aliases: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  serviceConfigs: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default MangaAdmin;
