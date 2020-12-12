import React, { useCallback, useState } from 'react';

import { makeStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import {
  Tooltip,
  Typography,
  Toolbar,
  IconButton,
} from '@material-ui/core';
import { Add as AddIcon } from '@material-ui/icons';

const useStyles = makeStyles(theme => ({
  root: {
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(1),
  },
  title: {
    flex: '1 1 100%',
  },
}));

export const TableToolbar = props => {
  const {
    title,
    DialogComponent,
    creatable,
  } = props;

  const classes = useStyles();
  const [createOpen, setCreateOpen] = useState(false);
  const handleClose = useCallback(() => setCreateOpen(false), []);
  const handleOpen = useCallback(() => setCreateOpen(true), []);

  return (
    <Toolbar
      className={classes.root}
    >
      {creatable && (
        <Tooltip title='Add'>
          <IconButton aria-label='Add item' onClick={handleOpen}>
            <AddIcon />
          </IconButton>
        </Tooltip>
      )}
      <Typography className={classes.title} variant='h6' aria-label='Table title'>
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
};
