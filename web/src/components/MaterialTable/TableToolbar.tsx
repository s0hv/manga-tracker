import React, {
  ComponentType,
  FunctionComponent,
  useCallback,
  useState,
} from 'react';

import PropTypes from 'prop-types';
import { IconButton, Toolbar, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';


export type DialogComponentProps = {
  open: boolean
  onClose: () => void
}

export type TableToolbarProps = {
  title?: string
  DialogComponent?: ComponentType<DialogComponentProps>
  creatable?: boolean
  addButtonLabel?: string
}


export const TableToolbar: FunctionComponent<TableToolbarProps> = props => {
  const {
    title,
    DialogComponent,
    creatable,
    addButtonLabel = 'add item',
  } = props;

  const [createOpen, setCreateOpen] = useState<boolean>(false);
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
      {creatable && DialogComponent && <DialogComponent open={createOpen} onClose={handleClose} />}
    </Toolbar>
  );
};

TableToolbar.propTypes = {
  title: PropTypes.string,
  DialogComponent: PropTypes.func,
  creatable: PropTypes.bool,
  addButtonLabel: PropTypes.string,
};
