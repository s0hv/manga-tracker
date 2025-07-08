import { type FC, useCallback } from 'react';
import DeleteIcon from '@mui/icons-material/Delete';
import { IconButton } from '@mui/material';
import type { IconButtonProps } from '@mui/material/IconButton/IconButton';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useConfirm } from 'material-ui-confirm';
import { useSnackbar } from 'notistack';
import { type Control, useWatch } from 'react-hook-form';

import { QueryKeys } from '@/webUtils/constants';

import { deleteNotification } from '../../api/notifications';

type DeleteReturn = Awaited<ReturnType<typeof deleteNotification>>;

export type DeleteNotificationButtonProps = {
  control?: Control<any>
  fieldName?: string
} & IconButtonProps;
const DeleteNotificationButton: FC<DeleteNotificationButtonProps> = ({
  control,
  fieldName = 'notificationId',
  ...buttonProps
}) => {
  const { mutateAsync } = useMutation<DeleteReturn, unknown, [number]>({ mutationFn: ([notificationId]) => deleteNotification(notificationId) });
  const queryClient = useQueryClient();
  const notificationId = useWatch({ name: fieldName, control }) as number;
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
          return queryClient.invalidateQueries({ queryKey: QueryKeys.NotificationsList });
        }
        return mutateAsync([notificationId])
          .then(() => {
            enqueueSnackbar('Notification deleted', { variant: 'success' });
            return queryClient.invalidateQueries({ queryKey: QueryKeys.NotificationsList });
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
