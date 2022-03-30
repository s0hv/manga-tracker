import { Paper, Box, Button } from '@mui/material';
import { Form, Field } from 'react-final-form';
import React, { useCallback, useMemo, useState } from 'react';
import { styled } from '@mui/material/styles';
import { TextField, Checkboxes } from 'mui-rff';
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


const NotificationsForm = styled('form')({
  width: '100%',
  display: 'flex',
});

/**
 * Field
 * @typedef {Object} Field
 * @property {string} name Name of the field
 * @property {string} value Value of the field
 * @property {boolean} optional Indicates whether the field is optional
 */

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

/**
 *
 * @param fields {Array<Field>} List of fields
 * @param property {string} Which property of the field to map
 * @returns {FieldObject|any}
 */
const mapFields = (fields, property = 'value') => fields.reduce((prev, curr) => ({
  ...prev,
  [curr.name]: curr[property],
}), {});

export const defaultData = {
  useFollows: false,
  notificationType: 1,
  disabled: false,
  groupByManga: false,
  manga: null,
  fields: [
    {
      value: '$MANGA_TITLE - Chapter $CHAPTER_NUMBER',
      name: 'embed_title',
      optional: false,
    },
    {
      value: '$TITLE\n$URL\nby $GROUP',
      name: 'embed_content',
      optional: false,
    },
    {
      value: '$GROUP',
      name: 'footer',
      optional: true,
    },
    {
      value: '$MANGA_COVER',
      name: 'thumbnail',
      optional: true,
    },
    {
      value: '$MANGA_TITLES',
      name: 'username',
      optional: true,
    },
    {
      value: '$URL',
      name: 'url',
      optional: true,
    },
  ],
};

const DiscordWebhookEditor = ({
  notificationData,
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
    ...mapFields(notificationData.fields),
  }),
  [notificationData]);

  const fieldOptional = useMemo(() => mapFields(notificationData.fields, 'optional'),
    [notificationData]);

  const onSubmit = useCallback((values, form) => {
    const data = {
      notificationId: values.notificationId,
      notificationType: NotificationTypes.DiscordWebhook,
      useFollows: values.useFollows,

      groupByManga: values.groupByManga,
      destination: values.destination,
      name: values.name,

      disabled: values.disabled,

      manga: values.useFollows ?
        undefined :
        values.manga.map(m => ({ mangaId: m.mangaId, serviceId: m.serviceId })),
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
            <NotificationsForm
              onSubmit={handleSubmit}
              sx={{
                flexFlow: 'column',
              }}
            >
              <ConfirmProvider>
                <DeleteNotificationButton sx={{
                  alignSelf: 'flex-end',
                }}
                />
              </ConfirmProvider>
              <Box sx={{
                display: 'flex',
              }}
              >
                <Box sx={{
                  mr: 4,
                }}
                >
                  <Field
                    name='notificationId'
                    component='input'
                    type='hidden'
                    subscription={{ value: true }}
                  />

                  <TextField
                    margin='normal'
                    name='name'
                    label='Name'
                    variant='standard'
                    inputProps={{ sx: { fontSize: 30 }}}
                    sx={{ mb: 5 }}
                  />
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
                    required
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
                    name='color'
                    label='Embed color'
                  />

                  <CSRFInput />
                  <Button
                    type='submit'
                    variant='contained'
                    color='primary'
                    disabled={submitting || hasValidationErrors}
                    sx={{ mt: 3, mb: 2, ml: 3 }}
                  >
                    Save
                  </Button>
                </Box>
                <Box sx={{
                  mt: 2,
                  minWidth: '15%',
                }}
                >
                  <Checkboxes
                    name='disabled'
                    color='primary'
                    data={{ label: 'Disabled' }}
                  />
                  <Checkboxes
                    name='groupByManga'
                    color='primary'
                    data={{ label: 'Group by manga' }}
                  />
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
                </Box>
              </Box>
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
