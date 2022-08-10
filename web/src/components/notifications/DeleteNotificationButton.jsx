import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useField } from 'react-final-form';
import { IconButton } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { useCallback } from 'react';
import { useConfirm } from 'material-ui-confirm';
import { useSnackbar } from 'notistack';
import PropTypes from 'prop-types';

import { deleteNotification } from '../../api/notifications';
import { QueryKeys } from '../../utils/constants';
import { useCSRF } from '../../utils/csrf';

const DeleteNotificationButton = ({ fieldName = 'notificationId', ...buttonProps }) => {
  const { mutateAsync } = useMutation(([csrf, notificationId]) => deleteNotification(csrf, notificationId));
  const queryClient = useQueryClient();
  const { input } = useField(fieldName);
  const csrf = useCSRF();
  const confirm = useConfirm();
  const { enqueueSnackbar } = useSnackbar();


  const deleteClicked = useCallback(() => {
    confirm({
      description: `Are you sure you want to delete this notification?`,
      confirmationText: 'Yes',
      cancellationText: 'No',
    })
      .then(() => {
        if (!input.value) {
          return queryClient.invalidateQueries(QueryKeys.NotificationsList);
        }
        return mutateAsync([csrf, input.value])
          .then(() => {
            enqueueSnackbar('Notification deleted', { variant: 'success' });
            return queryClient.invalidateQueries(QueryKeys.NotificationsList);
          })
          .catch(err => {
            console.log(err);
            enqueueSnackbar('Failed to delete notification', { variant: 'error' });
          });
      })
      .catch(() => {});
  }, [confirm, csrf, enqueueSnackbar, input.value, mutateAsync, queryClient]);

  return (
    <IconButton onClick={deleteClicked} aria-label='Delete notification' {...buttonProps}>
      <DeleteIcon />
    </IconButton>
  );
};
DeleteNotificationButton.propTypes = {
  fieldName: PropTypes.string,
};

export default DeleteNotificationButton;
