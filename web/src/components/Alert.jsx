import React, { useCallback } from 'react';
import { Snackbar } from '@material-ui/core';
import MuiAlert from '@material-ui/lab/Alert';


function Alert(props) {
  const {
    children,
    severity = 'success',
    open,
    setOpen,
  } = props;

  const handleAlertClose = useCallback((event, reason) => {
    if (reason === 'clickaway') {
      return;
    }

    setOpen(false);
  }, [setOpen]);

  return (
    <Snackbar open={open} autoHideDuration={8000} onClose={handleAlertClose}>
      <MuiAlert severity={severity} onClose={handleAlertClose} elevation={6} variant='filled'>
        {children}
      </MuiAlert>
    </Snackbar>
  );
}
export default Alert;
