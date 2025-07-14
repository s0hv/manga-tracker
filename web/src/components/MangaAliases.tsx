import React, { useCallback } from 'react';
import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';
import {
  IconButton,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import type { confirm } from 'material-ui-confirm';
import type { EnqueueSnackbar } from 'notistack';


import { updateMangaTitle } from '../api/admin/manga';
import { useUser } from '../utils/useUser';

const Root = styled('div')(({ theme }) => ({
  margin: theme.spacing(1),
  maxHeight: '250px',
  width: 'max-content',
}));

export type MangaAliasesProps = {
  aliases?: string[] | undefined
  mangaId?: number
  onTitleUpdate?: () => void
  enqueueSnackbar?: EnqueueSnackbar
  confirm?: typeof confirm
  allowEdits?: boolean
};
const MangaAliases = (props: MangaAliasesProps) => {
  const {
    aliases,
    mangaId,
    onTitleUpdate,
    enqueueSnackbar,
    confirm,
    allowEdits = false,
  } = props;

  const { isAdmin } = useUser();
  const autoHideDuration = 8000;

  const onAliasPromote = useCallback((title: string) => {
    if (!mangaId || !confirm || !enqueueSnackbar || !onTitleUpdate) {
      console.error('Missing required props for MangaAliases');
      return;
    }

    confirm({
      description: `Do you want to set "${title}" as the main title for this manga?`,
      confirmationText: 'Yes',
      cancellationText: 'No',
    }).then(({ confirmed }) => {
      if (!confirmed) return;

      return updateMangaTitle(mangaId, title)
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
    });
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

export default MangaAliases;
