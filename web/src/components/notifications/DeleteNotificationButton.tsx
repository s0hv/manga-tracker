import { useCallback } from 'react';
import DeleteIcon from '@mui/icons-material/Delete';
import { IconButton } from '@mui/material';
import type { IconButtonProps } from '@mui/material/IconButton';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useConfirm } from 'material-ui-confirm';
import { useSnackbar } from 'notistack';
import {
  type Control, type FieldPath,
  type FieldValues,
  useWatch,
} from 'react-hook-form';

import { deleteNotificationMutationOptions, notificationsQueryKey } from '#web/api/notifications';

export type DeleteNotificationButtonProps<T extends FieldValues> = {
  control?: Control<T>
  fieldName?: FieldPath<T>
} & IconButtonProps;
const DeleteNotificationButton = <T extends FieldValues>({
  control,
  fieldName = 'notificationId' as FieldPath<T>,
  ...buttonProps
}: DeleteNotificationButtonProps<T>) => {
  const { mutateAsync } = useMutation(deleteNotificationMutationOptions);
  const queryClient = useQueryClient();
  const notificationId = useWatch({ name: fieldName, control });
  const confirm = useConfirm();
  const { enqueueSnackbar } = useSnackbar();


  const deleteClicked = useCallback(() => {
    confirm({
      description: `Are you sure you want to delete this notification?`,
      confirmationText: 'Yes',
      cancellationText: 'No',
    })
      .then(reason => {
        if (!reason.confirmed) return;

        if (!notificationId) {
          return queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
        }

        return mutateAsync(notificationId)
          .then(() => {
            enqueueSnackbar('Notification deleted', { variant: 'success' });
          })
          .catch(() => {
            enqueueSnackbar('Failed to delete notification', { variant: 'error' });
          });
      });
  }, [confirm, enqueueSnackbar, notificationId, mutateAsync, queryClient]);

  return (
    <IconButton onClick={deleteClicked} aria-label='Delete notification' {...buttonProps}>
      <DeleteIcon />
    </IconButton>
  );
};

export default DeleteNotificationButton;
