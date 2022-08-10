import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Select,
  Box,
  MenuItem,
  Button,
  InputLabel,
  FormControl,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useSnackbar } from 'notistack';
import { getNotifications } from '../api/notifications';
import { NotificationTypes, QueryKeys } from '../utils/constants';
import { defaultDataForType } from '../components/notifications/defaultDatas';

const ResponsiveBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  paddingTop: theme.spacing(3),
  [theme.breakpoints.down('sm')]: {
    width: '100vw',
    position: 'sticky',
    left: 0,
    overflow: 'auto',
  },
}));

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
    <Container sx={{
      width: 'min-content',
    }}
    >
      <ResponsiveBox>
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
      </ResponsiveBox>
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
