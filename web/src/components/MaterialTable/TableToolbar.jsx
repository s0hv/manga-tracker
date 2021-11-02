import React, { useCallback, useState } from 'react';

import PropTypes from 'prop-types';
import { Tooltip, Typography, Toolbar, IconButton } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

export const TableToolbar = props => {
  const {
    title,
    DialogComponent,
    creatable,
    addButtonLabel = 'add item',
  } = props;

  const [createOpen, setCreateOpen] = useState(false);
  const handleClose = useCallback(() => setCreateOpen(false), []);
  const handleOpen = useCallback(() => setCreateOpen(true), []);

  return (
    <Toolbar sx={{ pl: 2, pr: 1 }}>
      {creatable && (
        <Tooltip title='Add'>
          <IconButton aria-label={addButtonLabel} onClick={handleOpen} size='large'>
            <AddIcon />
          </IconButton>
        </Tooltip>
      )}
      <Typography variant='h6' sx={{ flex: '1 1 100%' }}>
        {title}
      </Typography>
      {creatable && <DialogComponent open={createOpen} onClose={handleClose} />}
    </Toolbar>
  );
};

TableToolbar.propTypes = {
  title: PropTypes.string,
  DialogComponent: PropTypes.func,
  creatable: PropTypes.bool,
  addButtonLabel: PropTypes.string,
};
