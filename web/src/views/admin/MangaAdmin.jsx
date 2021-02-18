import { useConfirm } from 'material-ui-confirm';
import { useSnackbar } from 'notistack';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Container,
  Grid, IconButton,
  Paper, Tooltip,
  Typography,
} from '@material-ui/core';

import {
  SubdirectoryArrowLeft as SubdirectoryArrowLeftIcon,
} from '@material-ui/icons';

import { makeStyles } from '@material-ui/core/styles';
import Link from 'next/link';

import {
  Select,
} from 'mui-rff';
import MangaAliases from '../../components/MangaAliases';
import MangaInfo from '../../components/MangaInfo';

import {
  AddRowFormTemplate,
  EditableSelect,
  MaterialTable,
} from '../../components/MaterialTable';


const useStyles = makeStyles((theme) => ({
  title: {
    width: '75%',
    textAlign: 'left',
    paddingBottom: '10px',
    [theme.breakpoints.down('sm')]: {
      width: '100%',
    },
  },
  titleBar: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  thumbnail: {
    maxWidth: '250px',
    maxHeight: '355px',
    [theme.breakpoints.down('sm')]: {
      maxWidth: '200px',
    },
    [theme.breakpoints.down('xs')]: {
      maxWidth: '250px',
    },
  },
  details: {
    display: 'flex',
    flexFlow: 'row',
    [theme.breakpoints.down('xs')]: {
      flexFlow: 'wrap',
      justifyContent: 'center',
    },
  },
  paper: {
    padding: '1em',
    minWidth: '440px',
  },
  addRowForm: {
    minWidth: '150px',
  },
  infoGrid: {
    marginLeft: theme.spacing(4),
    width: 'fit-content',
    [theme.breakpoints.down('xs')]: {
      marginLeft: '0px',
    },
  },
}));


function MangaAdmin(props) {
  const {
    mangaData,
  } = props;

  // Constants
  const mangaId = mangaData.manga_id;

  // Hooks
  const classes = useStyles();
  const { enqueueSnackbar } = useSnackbar();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(false);
  const [scheduledUpdates, setScheduledUpdates] = useState([]);
  const [aliases, setAliases] = useState(mangaData.aliases);
  const [mangaTitle, setMangaTitle] = useState(mangaData.title);

  const formatScheduledRuns = useCallback((runs) => runs.map(run => {
    const found = mangaData.services.find(s => s.service_id === run.service_id);
    if (!found) {
      return run;
    }
    return {
      ...run,
      name: found.name,
    };
  }), [mangaData.services]);

  const onTitleChange = useCallback(() => {
    fetch(`/api/manga/${mangaId}`)
      .then(res => res.json())
      .then(json => {
        setAliases(json.manga.aliases);
        setMangaTitle(json.manga.title);
      });
  }, [mangaId]);

  // Data fetching callbacks
  const fetchData = useCallback(() => {
    setLoading(true);

    return fetch(`/api/admin/manga/${mangaId}/scheduledRuns`)
      .then(res => res.json())
      .then(json => {
        setScheduledUpdates(formatScheduledRuns(json.data || []));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [formatScheduledRuns, mangaId]);

  const onCreateRow = useCallback((form) => {
    fetch(`/api/admin/manga/${mangaId}/scheduledRun/${form.service_id}`, {
      method: 'POST',
    })
      .then(res => {
        if (res.status !== 200) {
          throw new Error(`Failed to create row ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .then(json => {
        setScheduledUpdates(formatScheduledRuns([...scheduledUpdates, json.inserted]));
        enqueueSnackbar(
          `Successfully scheduled manga ${mangaId} to be checked on service ${form.service_id}`,
          { variant: 'success' }
        );
      })
      .catch(err => enqueueSnackbar(err.message, { variant: 'error' }));
  }, [mangaId, formatScheduledRuns, scheduledUpdates, enqueueSnackbar]);

  const onDeleteRow = useCallback((row) => {
    const serviceId = row.values.service_id;
    fetch(`/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`, {
      method: 'DELETE',
    })
      .then(res => {
        if (res.status !== 200) {
          enqueueSnackbar(`Failed to delete row. ${res.status} ${res.statusText}`, { variant: 'error' });
        } else {
          setScheduledUpdates(
            formatScheduledRuns(scheduledUpdates.filter(r => r.service_id !== serviceId))
          );
          enqueueSnackbar(
            `Successfully deleted service ${row.values.name} from scheduled runs`,
            { variant: 'success' }
          );
        }
      })
      .catch(err => enqueueSnackbar(err.message, { variant: 'error' }));
  }, [enqueueSnackbar, formatScheduledRuns, mangaId, scheduledUpdates]);

  // Table layout
  const fields = useMemo(() => [
    <Select
      name='service_id'
      key='service_id'
      label='Service'
      SelectDisplayProps={{ 'aria-label': 'Service select' }}
      data={mangaData.services?.map(s => ({ value: s.service_id, label: s.name }))}
      required
    />,
  ], [mangaData.services]);

  const CreateDialog = useMemo(() => ({ open, onClose }) => (
    <AddRowFormTemplate
      fields={fields}
      onSubmit={onCreateRow}
      onClose={onClose}
      open={open}
      formClass={classes.addRowForm}
    />
  ), [fields, onCreateRow, classes.addRowForm]);

  const columns = useMemo(() => [
    {
      Header: 'Service name',
      accessor: 'name',
      EditCell: ({ row, cell, state }) => (
        <EditableSelect
          value={row.values.service_id}
          items={mangaData.services.map(s => ({ value: s.service_id, text: s.name }))}
          cell={cell}
          row={row}
          state={state}
          onChange={(serviceId) => {
            state.rowEditStates[row.id].service_id = serviceId;
          }}
        />
      ),
    },
    { Header: 'Service id', accessor: 'service_id', canEdit: false },
  ], [mangaData.services]);

  return (
    <Container maxWidth='lg' disableGutters>
      <Paper className={classes.paper}>
        <div className={classes.titleBar}>
          <Typography className={classes.title} variant='h4'>{mangaTitle}</Typography>
          <Link href={`/manga/${mangaId}`}>
            <Tooltip title='Go back'>
              <IconButton>
                <SubdirectoryArrowLeftIcon />
              </IconButton>
            </Tooltip>
          </Link>
        </div>
        <div className={classes.details}>
          <a href={mangaData.mal} target='_blank' rel='noreferrer noopener'>
            <img
              src={mangaData.cover}
              className={classes.thumbnail}
              alt={mangaData.title}
            />
          </a>
          <Grid
            container
            direction='column'
            className={classes.infoGrid}
          >
            <MangaInfo mangaData={mangaData} />
            <MangaAliases
              aliases={aliases}
              mangaId={mangaId}
              onTitleUpdate={onTitleChange}
              enqueueSnackbar={enqueueSnackbar}
              confirm={confirm}
              allowEdits
            />
          </Grid>
        </div>
        <MaterialTable
          data={scheduledUpdates}
          columns={columns}
          editable
          deletable
          creatable
          CreateDialog={CreateDialog}
          title='Forced checks'
          fetchData={fetchData}
          onDeleteRow={onDeleteRow}
          loading={loading}
        />
      </Paper>
    </Container>
  );
}

export default MangaAdmin;
