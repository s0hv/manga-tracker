import { useSnackbar } from 'notistack';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Container,
  Grid,
  Paper,
  Tooltip,
  Typography,
} from '@material-ui/core';

import { makeStyles } from '@material-ui/core/styles';

import {
  Select,
} from 'mui-rff';

import {
  defaultDateDistanceToNow,
  defaultDateFormat,
} from '../utils/utilities';
import {
  AddRowFormTemplate,
  EditableSelect,
  MaterialTable,
} from './MaterialTable';


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
      maxWidth: '180px',
    },
    [theme.breakpoints.down('xs')]: {
      maxWidth: '125px',
    },
  },
  details: {
    display: 'flex',
  },
  detailText: {
    marginLeft: '5px',
    [theme.breakpoints.down('sm')]: {
      marginLeft: '3px',
    },
  },
  infoTable: {
    marginLeft: '30px',
    marginTop: '3px',
    [theme.breakpoints.down('sm')]: {
      marginLeft: '20px',
    },
    [theme.breakpoints.down('xs')]: {
      marginLeft: '10px',
    },
  },
  paper: {
    padding: '1em',
    minWidth: '440px',
  },
  addRowForm: {
    minWidth: '150px',
  },
}));


function MangaAdmin(props) {
  const {
    mangaData,
  } = props;

  // Constants
  const mangaId = mangaData.manga_id;
  const latestRelease = mangaData.latest_release ?
    new Date(mangaData.latest_release) :
    null;
  const estimatedRelease = new Date(mangaData.estimated_release);

  // Simple hooks
  const classes = useStyles();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [scheduledUpdates, setScheduledUpdates] = useState([]);

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
      data={mangaData.services.map(s => ({ value: s.service_id, label: s.name }))}
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
          <Typography className={classes.title} variant='h4'>{mangaData.title}</Typography>
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
            justify='space-between'
          >
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
              </tbody>
            </table>
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
