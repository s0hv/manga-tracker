import { styled } from '@mui/material/styles';
import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';

import React, { useCallback } from 'react';
import {
  IconButton,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';

import PropTypes from 'prop-types';
import { useUser } from '../utils/useUser';
import { updateMangaTitle } from '../api/admin/manga';

const Root = styled('div')(({ theme }) => ({
  margin: theme.spacing(1),
  maxHeight: '250px',
  width: 'max-content',
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

  const { isAdmin } = useUser();
  const autoHideDuration = 8000;

  const onAliasPromote = useCallback((title) => {
    confirm({
      description: `Do you want to set "${title}" as the main title for this manga?`,
      confirmationText: 'Yes',
      cancellationText: 'No',
    }).then(() => {
      updateMangaTitle(mangaId, title)
        .then(json => {
          enqueueSnackbar(
            `Set "${title}" as the main title. ${json.message}`,
            { variant: 'success', autoHideDuration }
          );
          onTitleUpdate();
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
    <Root id='manga-aliases'>
      <Typography>Alternative titles</Typography>
      <List sx={{ overflow: 'auto', maxHeight: '100%' }}>
        {aliases.map(alias => (
          <ListItem key={alias} dense>
            <ListItemText primary={alias} sx={{ mt: '0px', mb: '0px' }} />
            {allowEdits && isAdmin && (
              <Tooltip title='Set as main title'>
                <IconButton
                  size='small'
                  onClick={() => onAliasPromote(alias)}
                  aria-label='Set alias as main title'
                >
                  <DoubleArrowIcon sx={{ transform: 'rotate(-90deg)' }} />
                </IconButton>
              </Tooltip>
            )}
          </ListItem>
        ))}
      </List>
    </Root>
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
