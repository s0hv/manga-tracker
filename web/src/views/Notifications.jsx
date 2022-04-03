import { useQuery, useQueryClient } from 'react-query';
import {
  Container,
  Select,
  Box,
  MenuItem,
  Button,
  InputLabel,
  FormControl,
} from '@mui/material';
import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useSnackbar } from 'notistack';
import { getNotifications } from '../api/notifications';
import { NotificationTypes, QueryKeys } from '../utils/constants';
import { defaultDataForType } from '../components/notifications/defaultDatas';


const DiscordWebhookEditor = dynamic(() => import('../components/notifications/DiscordWebhookEditor'));
const WebhookEditor = dynamic(() => import('../components/notifications/WebhookEditor'));

const NotificationComponents = {
  [NotificationTypes.DiscordWebhook]: DiscordWebhookEditor,
  [NotificationTypes.Webhook]: WebhookEditor,
};

const queryKey = QueryKeys.NotificationsList;

const Notifications = () => {
  const { enqueueSnackbar } = useSnackbar();
  const onError = useCallback((err) => {
    console.error(err);
    enqueueSnackbar('Failed to load notifications', { variant: 'error' });
  }, [enqueueSnackbar]);

  const { data: notificationData, isLoading } = useQuery(queryKey, getNotifications, {
    onError,
  });
  const [notifType, setNotifType] = useState(NotificationTypes.DiscordWebhook);
  const queryClient = useQueryClient();

  const addNewNotification = useCallback(() => {
    queryClient.setQueryData(queryKey, [defaultDataForType[notifType], ...notificationData]);
  }, [notifType, notificationData, queryClient]);

  const defaultExpanded = useMemo(() => notificationData?.length < 3, [notificationData?.length]);

  return (
    <Container>
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mt: 2,
      }}
      >
        <FormControl>
          <InputLabel id='selectLabelId'>Notification type to create</InputLabel>
          <Select
            labelId='selectLabelId'
            value={notifType}
            onChange={e => setNotifType(e.target.value)}
            label='Notification type to create'
            sx={{ m: 1 }}
          >
            <MenuItem value={NotificationTypes.DiscordWebhook}>Discord webhook</MenuItem>
            <MenuItem value={NotificationTypes.Webhook}>Generic webhook</MenuItem>
          </Select>
        </FormControl>

        <Button
          disabled={isLoading}
          onClick={addNewNotification}
          variant='contained'
          sx={{ m: 1 }}
        >
          Create new notification
        </Button>
      </Box>
      {!isLoading && Array.isArray(notificationData) && notificationData.map(notif => {
        const Component = NotificationComponents[notif.notificationType];
        if (!Component) return <span>Invalid notification type {notif.notificationType}</span>;
        return (
          <Component
            notificationData={notif}
            defaultExpanded={!notif.notificationId || defaultExpanded}
            key={notif.notificationId || 'temp'}
          />
        );
      })}
    </Container>
  );
};

export default Notifications;
