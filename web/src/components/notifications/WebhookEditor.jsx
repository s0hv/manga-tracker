import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { Field, Form } from 'react-final-form';
import {
  Box,
  FormControl,
  FormHelperText,
  FormLabel,
  Paper,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import { TextField } from 'mui-rff';
import { ConfirmProvider } from 'material-ui-confirm';

import { NotificationTypes } from '../../utils/constants';
import {
  CollapsableLayout,
  FlexLayout,
  NotificationTypeText,
  RightSide,
} from './Layout';
import CSRFInput from '../utils/CSRFInput';
import SaveButton from './SaveButton.js';
import NameInput from './NameInput';
import MangaSelector from './MangaSelector';
import DeleteNotificationButton from './DeleteNotificationButton';
import NotificationsForm from './NotificationsForm.js';
import { postNotifications } from '../../api/notifications';
import NotificationIdField from './NotificationIdField.js';
import {
  buildNotificationData,
  mapNotificationFields,
} from '../../utils/utilities';
import DefaultHelpTexts from './DefaultHelpTexts';


const validateJson = (value) => {
  try {
    const parsed = JSON.parse(value);
    if (!parsed.$CHAPTER_FORMAT || typeof parsed.$CHAPTER_FORMAT !== 'object') {
      return '$CHAPTER_FORMAT must be defined at the root and it must be an object';
    }

    if (!parsed.$CHAPTER_ARRAY) {
      return '$CHAPTER_ARRAY must be defined at the root';
    }
  } catch (err) {
    return err.toString();
  }
};

const WebhookEditor = ({ notificationData, defaultExpanded = false }) => {
  const [subscription] = useState({
    submitting: true,
    submitError: true,
  });
  const initialValues = useMemo(() => ({
    ...notificationData,
    fields: undefined,
    ...mapNotificationFields(notificationData.fields),
  }), [notificationData]);

  const { enqueueSnackbar } = useSnackbar();

  const onSubmit = useCallback((values, form) => {
    const error = validateJson(values.json);
    if (error) {
      return { json: error };
    }

    const data = {
      ...buildNotificationData(values),
      notificationType: NotificationTypes.Webhook,
      fields: [
        { name: 'json', value: values.json },
      ],
    };

    postNotifications(values._csrf, data)
      .then(({ notificationId }) => {
        if (notificationId) {
          form.change('notificationId', notificationId);
        }
        enqueueSnackbar('Notification saved', { variant: 'success' });
      })
      .catch(() => enqueueSnackbar('Failed to create/update notification', { variant: 'error' }));
  }, [enqueueSnackbar]);

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
        >
          {({ handleSubmit, submitting }) => (
            <NotificationsForm onSubmit={handleSubmit}>
              <FlexLayout>
                <NotificationTypeText>JSON webhook</NotificationTypeText>

                <ConfirmProvider>
                  <DeleteNotificationButton />
                </ConfirmProvider>
              </FlexLayout>
              <NameInput />
              <CollapsableLayout defaultExpanded={defaultExpanded}>
                <FlexLayout>
                  <Box sx={{
                    flexGrow: 1,
                    mr: 4,
                    flexFlow: 'row',
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
                        mb: 2,
                        mr: 2,
                        flexGrow: 1,
                      }}
                      useFollowsName='useFollows'
                    />

                    <Field
                      name='json'
                    >
                      {({ input, meta }) => (
                        <FormControl error={Boolean(meta.submitError)} sx={{ width: '100%' }} required>
                          <FormLabel>Webhook json format</FormLabel>
                          <CodeMirror
                            value={input.value}
                            minHeight='100px'
                            extensions={[
                              json(),
                            ]}
                            theme='dark'
                            onChange={input.onChange}
                          />
                          <FormHelperText>{meta.submitError}</FormHelperText>
                        </FormControl>
                      )}
                    </Field>
                    <CSRFInput />
                    <SaveButton
                      submitting={submitting}
                    />
                  </Box>
                  <RightSide>
                    <div style={{ minHeight: '5%' }} />
                    Formatting help<br /><br />
                    <DefaultHelpTexts />
                  </RightSide>
                </FlexLayout>
              </CollapsableLayout>
            </NotificationsForm>
          )}
        </Form>
      </Box>
    </Paper>
  );
};

export default WebhookEditor;
