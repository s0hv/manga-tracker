import { makeStyles } from '@material-ui/core/styles';
import { DoubleArrow as DoubleArrowIcon } from '@material-ui/icons';

import React, { useCallback } from 'react';
import {
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography, Tooltip,
} from '@material-ui/core';

import PropTypes from 'prop-types';
import { useUser } from '../utils/useUser';

const useStyles = makeStyles((theme) => ({
  root: {
    margin: theme.spacing(1),
    maxHeight: '250px',
    width: 'max-content',
  },
  list: {
    overflow: 'auto',
    maxHeight: '100%',
  },
  listItem: {
    marginTop: '0px',
    marginBottom: '0px',
  },
  promoteIcon: {
    transform: 'rotate(-90deg)',
  },
}));

const MangaAliases = (props) => {
  const {
    aliases,
    mangaId,
    onTitleUpdate,
    enqueueSnackbar,
    confirm,
    allowEdits=false,
  } = props;

  const classes = useStyles();
  const { isAdmin } = useUser();
  const autoHideDuration = 8000;

  const onAliasPromote = useCallback((title) => {
    confirm({
      description: `Do you want to set "${title}" as the main title for this manga?`,
      confirmationText: 'Yes',
      cancellationText: 'No',
    }).then(() => {
      fetch(`/api/admin/manga/${mangaId}/title`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      })

        .then(res => res.json())

        .then(json => {
          if (json.error) {
            enqueueSnackbar(
              `Failed to set alias as main title. ${json.error}`,
              { variant: 'error', autoHideDuration }
            );
          } else if (onTitleUpdate) {
            enqueueSnackbar(
              `Set "${title}" as the main title. ${json.message}`,
              { variant: 'success', autoHideDuration }
            );
            onTitleUpdate();
          }
        })

        .catch(err => enqueueSnackbar(
          `Failed to set title. ${err}`,
          { variant: 'error', autoHideDuration }
        ));
    })
      .catch(() => {});
  }, [enqueueSnackbar, mangaId, onTitleUpdate, confirm]);

  if (!aliases || aliases.length === 0) return null;

  return (
    <div id='manga-aliases' className={classes.root}>
      <Typography>Alternative titles</Typography>
      <List className={classes.list}>
        {aliases.map(alias => (
          <ListItem key={alias} dense>
            <ListItemText primary={alias} className={classes.listItem} />
            {allowEdits && isAdmin && (
              <Tooltip title='Set as main title'>
                <IconButton
                  size='small'
                  onClick={() => onAliasPromote(alias)}
                  aria-label='Set alias as main title'
                >
                  <DoubleArrowIcon className={classes.promoteIcon} />
                </IconButton>
              </Tooltip>
            )}
          </ListItem>
        ))}
      </List>
    </div>
  );
};

MangaAliases.propTypes = {
  aliases: PropTypes.arrayOf(PropTypes.string),
  mangaId: PropTypes.number,
  onTitleUpdate: PropTypes.func,
  enqueueSnackbar: PropTypes.func,
  confirm: PropTypes.func,
  allowEdits: PropTypes.bool,
};

export default MangaAliases;
