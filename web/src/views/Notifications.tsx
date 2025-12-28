import { type FC, lazy, Suspense, useCallback, useMemo, useState } from 'react';
import {
  Button,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { defaultDataForType } from '@/components/notifications/defaultDatas';
import type { NotificationData } from '@/types/api/notifications';

import { getNotifications } from '../api/notifications';
import {
  type NotificationType,
  NotificationTypes,
  QueryKeys,
} from '../utils/constants';

const ResponsiveBox = styled('div')(({ theme }) => ({
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

const DiscordWebhookEditor = lazy(() => import('../components/notifications/DiscordWebhookEditor'));
const WebhookEditor = lazy(() => import('../components/notifications/WebhookEditor'));

const NotificationComponents = {
  [NotificationTypes.DiscordWebhook]: DiscordWebhookEditor,
  [NotificationTypes.Webhook]: WebhookEditor,
};

const queryKey = QueryKeys.NotificationsList;

const Notifications: FC = () => {
  const { data: notificationData, isLoading } = useQuery({
    queryKey,
    queryFn: getNotifications,
  });
  const [notifType, setNotifType] = useState<NotificationType>(NotificationTypes.DiscordWebhook);
  const queryClient = useQueryClient();

  const addNewNotification = useCallback(() => {
    queryClient.setQueryData<Partial<NotificationData>[]>(queryKey, prev => [defaultDataForType[notifType], ...(prev ?? [])]);
  }, [notifType, queryClient]);

  const defaultExpanded = useMemo(() => (notificationData?.length ?? 0) < 3, [notificationData?.length]);

  return (
    <Container sx={{
      width: {
        md: 'min-content',
        lg: '1100px',
      },
    }}
    >
      <ResponsiveBox>
        <FormControl>
          <InputLabel id='selectLabelId'>Notification type to create</InputLabel>
          <Select
            labelId='selectLabelId'
            value={notifType}
            onChange={e => setNotifType(e.target.value as NotificationType)}
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
      {!isLoading && Array.isArray(notificationData) && notificationData.map((notif, idx) => {
        const Component = NotificationComponents[notif.notificationType as keyof typeof NotificationComponents];
        if (!Component) return <span>Invalid notification type {notif.notificationType}</span>;
        return (
          <Suspense key={notif.notificationId || `temp-${idx}`}>
            <Component
              notificationData={notif}
              defaultExpanded={!notif.notificationId || defaultExpanded}
            />
          </Suspense>
        );
      })}
    </Container>
  );
};

export default Notifications;
