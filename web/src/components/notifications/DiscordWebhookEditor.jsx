import { Paper, Box } from '@mui/material';
import { Form } from 'react-final-form';
import React, { useCallback, useMemo, useState } from 'react';
import { TextField } from 'mui-rff';
import PropTypes from 'prop-types';
import { useSnackbar } from 'notistack';
import { ConfirmProvider } from 'material-ui-confirm';

import CSRFInput from '../utils/CSRFInput';
import ColorPicker from './ColorPicker';
import MangaSelector from './MangaSelector';
import { NotificationTypes } from '../../utils/constants';
import { postNotifications } from '../../api/notifications';
import DeleteNotificationButton from './DeleteNotificationButton';
import FormatHelpText from './FormatHelpText';
import DefaultHelpTexts from './DefaultHelpTexts';
import SaveButton from './SaveButton';
import {
  FlexLayout,
  RightSide,
  CollapsableLayout,
  NotificationTypeText,
} from './Layout';
import NameInput from './NameInput';
import NotificationsForm from './NotificationsForm';
import NotificationIdField from './NotificationIdField';
import {
  buildNotificationData,
  mapNotificationFields,
} from '../../utils/utilities';


/**
 * Fields reduced into a single object
 * @typedef {Object} FieldObject
 * @property {string} [message]
 * @property {string} [embed_title]
 * @property {string} [username]
 * @property {string} [avatar_url]
 * @property {string} [embed_content]
 * @property {string} [url]
 * @property {string} [footer]
 * @property {string} [thumbnail]
 * @property {string} [color]
 */


const DiscordWebhookEditor = ({
  notificationData,
  defaultExpanded = false,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const initialValues = useMemo(() => ({
    notificationId: notificationData.notificationId,
    destination: notificationData.destination,
    disabled: notificationData.disabled,
    groupByManga: notificationData.groupByManga,
    name: notificationData.name,
    useFollows: notificationData.useFollows,
    manga: notificationData.manga,
    ...mapNotificationFields(notificationData.fields),
  }),
  [notificationData]);

  /** @type {FieldObject} */
  const fieldOptional = useMemo(() => mapNotificationFields(notificationData.fields, 'optional'),
    [notificationData]);

  const onSubmit = useCallback((values, form) => {
    const data = {
      ...buildNotificationData(values),
      notificationType: NotificationTypes.DiscordWebhook,
      fields: [
        { name: 'username', value: values.username },
        { name: 'embed_title', value: values.embed_title },
        { name: 'message', value: values.message },
        { name: 'url', value: values.url },
        { name: 'avatar_url', value: values.avatar_url },
        { name: 'embed_content', value: values.embed_content },
        { name: 'footer', value: values.footer },
        { name: 'thumbnail', value: values.thumbnail },
        { name: 'color', value: values.color },
      ].filter(f => f.value?.length > 0),
    };

    postNotifications(values._csrf, data)
      .then(({ notificationId }) => {
        form.change('notificationId', notificationId);
        enqueueSnackbar('Notification saved', { variant: 'success' });
      })
      .catch(() => enqueueSnackbar('Failed to create/update notification', { variant: 'error' }));
  }, [enqueueSnackbar]);

  const [subscription] = useState({ submitting: true, hasValidationErrors: true });

  return (
    <Paper>
      <Box sx={{
        p: 4,
        m: 2,
      }}
      >
        <Form
          onSubmit={onSubmit}
          initialValues={initialValues}
          subscription={subscription}
          render={({ handleSubmit, submitting, hasValidationErrors }) => (
            <NotificationsForm onSubmit={handleSubmit}>
              <FlexLayout>
                <NotificationTypeText>Discord webhook</NotificationTypeText>
                <ConfirmProvider>
                  <DeleteNotificationButton />
                </ConfirmProvider>
              </FlexLayout>

              <NameInput />

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
                    />

                    <MangaSelector
                      name='manga'
                      label='Manga updates to notify on'
                      sx={{
                        mt: 2,
                        mb: 1,
                        mr: 2,
                        flexGrow: 1,
                      }}
                      useFollowsName='useFollows'
                    />

                    <TextField
                      variant='outlined'
                      margin='normal'
                      autoComplete='off'
                      required={fieldOptional.username === false}
                      name='username'
                      label='Webhook username'
                    />
                    <TextField
                      variant='outlined'
                      margin='normal'
                      fullWidth
                      required={fieldOptional.embed_title === false}
                      name='embed_title'
                      label='Embed title'
                    />
                    <TextField
                      variant='outlined'
                      margin='normal'
                      multiline
                      required={fieldOptional.message === false}
                      name='message'
                      label='Message'
                    />
                    <TextField
                      variant='outlined'
                      margin='normal'
                      fullWidth
                      required={fieldOptional.url === false}
                      name='url'
                      label='Embed url'
                    />
                    <TextField
                      variant='outlined'
                      margin='normal'
                      required={fieldOptional.avatar_url === false}
                      name='avatar_url'
                      label='Webhook user avatar url'
                    />
                    <TextField
                      variant='outlined'
                      margin='normal'
                      fullWidth
                      multiline
                      required={fieldOptional.embed_content === false}
                      name='embed_content'
                      label='Embed content'
                    />
                    <TextField
                      variant='outlined'
                      margin='normal'
                      fullWidth
                      required={fieldOptional.footer === false}
                      name='footer'
                      label='Footer content'
                    />
                    <TextField
                      variant='outlined'
                      margin='normal'
                      fullWidth
                      required={fieldOptional.thumbnail === false}
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

                    <CSRFInput />
                    <SaveButton
                      submitting={submitting}
                      hasValidationErrors={hasValidationErrors}
                    />
                  </Box>
                  <RightSide>
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
      </Box>
    </Paper>
  );
};

DiscordWebhookEditor.propTypes = {
  notificationData: PropTypes.object.isRequired,
};

export default DiscordWebhookEditor;
