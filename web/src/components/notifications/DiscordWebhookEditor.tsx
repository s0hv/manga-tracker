import { Box, Paper } from '@mui/material';
import { Form } from 'react-final-form';
import dynamic from 'next/dynamic';
import React, { useCallback, useMemo, useState } from 'react';
import { TextField } from 'mui-rff';
import { useSnackbar } from 'notistack';
import { ConfirmProvider } from 'material-ui-confirm';
import type { FormApi } from 'final-form';

import ColorPicker from './ColorPicker';
import MangaSelector from './MangaSelector';
import { NotificationTypes } from '@/webUtils/constants';
import {
  postNotificationOverride,
  postNotifications,
} from '../../api/notifications';
import DeleteNotificationButton from './DeleteNotificationButton';
import FormatHelpText from './FormatHelpText';
import DefaultHelpTexts from './DefaultHelpTexts';
import SaveButton from './SaveButton';
import {
  CollapsableLayout,
  FlexLayout,
  NotificationTypeText,
  RightSide,
} from './Layout';
import NameInput from './NameInput';
import NotificationsForm from './NotificationsForm';
import NotificationIdField from './NotificationIdField';
import {
  buildNotificationData,
  mapNotificationFields,
} from '@/webUtils/utilities';
import type {
  NotificationData,
  NotificationField,
} from '@/types/api/notifications';
import type { FormValues } from '@/components/notifications/types';
import { useCSRF } from '@/webUtils/csrf';

const MangaOverrideSelector = dynamic(() => import('./MangaOverrideSelector'));

export type DiscordWebhookEditorProps = {
  notificationData: NotificationData
  defaultExpanded: boolean
}

type FieldTypes = {
  username?: string,
  embed_title: string,
  message?: string,
  url?: string,
  avatar_url?: string,
  embed_content: string,
  footer?: string,
  thumbnail?: string,
  color?: string
}

const getFields = (values: FormValues<FieldTypes>) => [
  { name: 'username', value: values.username },
  { name: 'embed_title', value: values.embed_title },
  { name: 'message', value: values.message },
  { name: 'url', value: values.url },
  { name: 'avatar_url', value: values.avatar_url },
  { name: 'embed_content', value: values.embed_content },
  { name: 'footer', value: values.footer },
  { name: 'thumbnail', value: values.thumbnail },
  { name: 'color', value: values.color },
].filter(f => (f.value?.length || 0) > 0);


const getNotificationFields = (override: number | null, notificationData: NotificationData): NotificationField[] => {
  if (override === null) return notificationData.fields;

  const fields = notificationData.overrides[override];
  return fields || [];
};

const getInitialValues = (notificationData: NotificationData, notificationFields: NotificationField[]): Partial<FormValues<FieldTypes>> => ({
  notificationId: notificationData.notificationId,
  destination: notificationData.destination,
  disabled: notificationData.disabled,
  groupByManga: notificationData.groupByManga,
  name: notificationData.name,
  useFollows: notificationData.useFollows,
  manga: notificationData.manga,
  ...mapNotificationFields(notificationFields),
});

const mapOverrides = (notificationData: NotificationData) => new Set(Object.keys(notificationData.overrides).map(v => Number(v)));


const DiscordWebhookEditor: React.FC<DiscordWebhookEditorProps> = ({
  notificationData: notificationDataProp,
  defaultExpanded = false,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [override, setOverride] = useState<number | null>(null);
  const [notificationData] = useState<NotificationData>(notificationDataProp);
  const [overrides, setOverrides] = useState<Set<number>>(mapOverrides(notificationData));
  const csrf = useCSRF();
  const notificationFields = useMemo<NotificationField[]>(() => getNotificationFields(override, notificationData),
    [notificationData, override]);

  const initialValues: Partial<FormValues<FieldTypes>> = useMemo(() => getInitialValues(notificationData, notificationFields),
    [notificationData, notificationFields]);

  const fieldOptional = useMemo(() => mapNotificationFields(notificationData.fields, 'optional'),
    [notificationData]);

  const onSubmit = useCallback((values: FormValues<FieldTypes>, form: FormApi<any, Partial<FormValues<FieldTypes>>>) => {
    const data = {
      ...buildNotificationData(values),
      notificationType: NotificationTypes.DiscordWebhook,
      fields: getFields(values),
    };

    // csrf token can't be in the form here as it gets reset when changing override
    postNotifications(csrf, data)
      .then((newData) => {
        form.restart(getInitialValues(newData, getNotificationFields(override, newData)));
        setOverrides(mapOverrides(newData));
        enqueueSnackbar('Notification saved', { variant: 'success' });
      })
      .catch(() => enqueueSnackbar('Failed to create/update notification', { variant: 'error' }));
  }, [csrf, enqueueSnackbar, override]);

  const onSubmitOverride = useCallback((values: FormValues<FieldTypes>, form: FormApi<any, Partial<FormValues<FieldTypes>>>) => {
    const data = {
      notificationType: NotificationTypes.DiscordWebhook,
      notificationId: values.notificationId,
      overrideId: override,
      fields: getFields(values),
    };

    // csrf token can't be in the form here as it gets reset when changing override
    postNotificationOverride(csrf, data)
      .then((newData) => {
        form.restart(getInitialValues(newData, getNotificationFields(override, newData)));
        setOverrides(mapOverrides(newData));
        enqueueSnackbar('Notification override saved', { variant: 'success' });
      })
      .catch(() => enqueueSnackbar('Failed to create/update notification override', { variant: 'error' }));
  }, [csrf, enqueueSnackbar, override]);

  const [subscription] = useState({ submitting: true, hasValidationErrors: true, dirty: true });
  const isOverride = override !== null;

  return (
    <Paper>
      <Box sx={{
        p: 4,
        m: 2,
      }}
      >
        <ConfirmProvider>
          <Form
            onSubmit={isOverride ? onSubmitOverride : onSubmit}
            initialValues={initialValues}
            subscription={subscription}
            render={({ handleSubmit, submitting, hasValidationErrors }) => (
              <NotificationsForm onSubmit={handleSubmit}>
                <FlexLayout>
                  <NotificationTypeText>Discord webhook</NotificationTypeText>
                  <DeleteNotificationButton disabled={isOverride} />
                </FlexLayout>

                <NameInput disabled={isOverride} />

                <CollapsableLayout defaultExpanded={defaultExpanded}>
                  <FlexLayout>
                    <Box sx={{
                      mr: 4,
                    }}
                    >
                      <NotificationIdField />

                      <TextField
                        variant='outlined'
                        margin='normal'
                        required
                        name='destination'
                        label='Webhook url'
                        disabled={isOverride}
                      />

                      <MangaSelector
                        name='manga'
                        label='Manga updates to notify on'
                        useFollowsName='useFollows'
                        sx={{
                          mt: 2,
                          mb: 1,
                          mr: 2,
                          flexGrow: 1,
                        }}
                        disabled={isOverride}
                      />

                      <MangaOverrideSelector
                        name='overrideId'
                        label='Manga override'
                        useFollowsName='useFollows'
                        overrides={overrides}
                        setOverride={setOverride}
                        sx={{
                          mt: 2,
                          mb: 1,
                          mr: 2,
                          flexGrow: 1,
                        }}
                      />

                      <TextField
                        variant='outlined'
                        margin='normal'
                        autoComplete='off'
                        required={!isOverride && !fieldOptional.username}
                        name='username'
                        label='Webhook username'
                      />
                      <TextField
                        variant='outlined'
                        margin='normal'
                        fullWidth
                        required={!isOverride && !fieldOptional.embed_title}
                        name='embed_title'
                        label='Embed title'
                      />
                      <TextField
                        variant='outlined'
                        margin='normal'
                        multiline
                        required={!isOverride && !fieldOptional.message}
                        name='message'
                        label='Message'
                      />
                      <TextField
                        variant='outlined'
                        margin='normal'
                        fullWidth
                        required={!isOverride && !fieldOptional.url}
                        name='url'
                        label='Embed url'
                      />
                      <TextField
                        variant='outlined'
                        margin='normal'
                        required={!isOverride && !fieldOptional.avatar_url}
                        name='avatar_url'
                        label='Webhook user avatar url'
                      />
                      <TextField
                        variant='outlined'
                        margin='normal'
                        fullWidth
                        multiline
                        required={!isOverride && !fieldOptional.embed_content}
                        name='embed_content'
                        label='Embed content'
                      />
                      <TextField
                        variant='outlined'
                        margin='normal'
                        fullWidth
                        required={!isOverride && !fieldOptional.footer}
                        name='footer'
                        label='Footer content'
                      />
                      <TextField
                        variant='outlined'
                        margin='normal'
                        fullWidth
                        required={!isOverride && !fieldOptional.thumbnail}
                        name='thumbnail'
                        label='Embed thumbnail'
                      />
                      <ColorPicker
                        sx={{
                          mt: 2,
                        }}
                        defaultValue={initialValues.color}
                        name='color'
                        label='Embed color'
                      />

                      <SaveButton
                        submitting={submitting}
                        hasValidationErrors={hasValidationErrors}
                      />
                    </Box>
                    <RightSide disabled={isOverride}>
                      <div style={{ height: '10%' }} />
                      <Box sx={{
                        maxWidth: 'min-content',
                      }}
                      >
                        Formatting help<br /><br />
                        <DefaultHelpTexts />
                        <br />
                        {/* eslint-disable-next-line react/no-unescaped-entities */}
                        Only the following formatting is available for "Username" and "Message" <br /><br />
                        <FormatHelpText
                          name='$MANGA_TITLES'
                          description='Comma separated list of all unique manga titles contained in the notification'
                        />
                      </Box>
                    </RightSide>
                  </FlexLayout>
                </CollapsableLayout>
              </NotificationsForm>
            )}
          />
        </ConfirmProvider>
      </Box>
    </Paper>
  );
};

export default DiscordWebhookEditor;
