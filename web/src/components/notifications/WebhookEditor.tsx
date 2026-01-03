import React, { useCallback, useMemo } from 'react';
import {
  Box,
  FormControl,
  FormHelperText,
  FormLabel,
  Paper,
} from '@mui/material';
import { json } from '@codemirror/lang-json';
import CodeMirror from '@uiw/react-codemirror';
import { ConfirmProvider } from 'material-ui-confirm';
import { useSnackbar } from 'notistack';
import { type SubmitHandler, useController, useForm } from 'react-hook-form';
import { TextFieldElement } from 'react-hook-form-mui';

import { postNotifications } from '#web/api/notifications';
import type { FormValues } from '@/components/notifications/types';
import type { NotificationData } from '@/types/api/notifications';
import { NotificationTypes } from '@/webUtils/constants';
import {
  buildNotificationData,
  mapNotificationFields,
} from '@/webUtils/utilities';


import DefaultHelpTexts from './DefaultHelpTexts';
import DeleteNotificationButton from './DeleteNotificationButton';
import {
  CollapsableLayout,
  FlexLayout,
  NotificationTypeText,
  RightSide,
} from './Layout';
import MangaSelector from './MangaSelector';
import { NameInput } from './NameInput';
import NotificationIdField from './NotificationIdField';
import NotificationsForm from './NotificationsForm';
import SaveButton from './SaveButton';


const validateJson = (value: string): string | undefined => {
  try {
    const parsed = JSON.parse(value);
    if (!parsed.$CHAPTER_FORMAT || typeof parsed.$CHAPTER_FORMAT !== 'object') {
      return '$CHAPTER_FORMAT must be defined at the root and it must be an object';
    }

    if (!parsed.$CHAPTER_ARRAY) {
      return '$CHAPTER_ARRAY must be defined at the root';
    }
  } catch (err) {
    if (err instanceof Error) {
      return err.toString();
    }
    return String(err);
  }
};

interface JsonFormValues extends FormValues {
  json: string
}

export type WebhookEditorProps = {
  notificationData: NotificationData
  defaultExpanded?: boolean
};
const WebhookEditor = ({ notificationData, defaultExpanded = false }: WebhookEditorProps) => {
  const initialValues = useMemo<JsonFormValues>(() => ({
    ...notificationData,
    fields: undefined,
    ...mapNotificationFields(notificationData.fields),
  }) as unknown as JsonFormValues, [notificationData]);

  const { enqueueSnackbar } = useSnackbar();

  const {
    handleSubmit,
    setValue,
    formState,
    control,
    setError,
  } = useForm<JsonFormValues>({
    defaultValues: initialValues,
  });
  const { isSubmitting } = formState;

  const {
    field,
    fieldState,
  } = useController({ control, name: 'json' });
  const {
    value: jsonValue,
    onChange: jsonOnChange,
  } = field;
  const {
    error: jsonError,
  } = fieldState;

  const onSubmit = useCallback<SubmitHandler<JsonFormValues>>(values => {
    const error = validateJson(values.json);
    if (error) {
      setError('json', {
        type: 'value',
        message: error,
      });
      return;
    }

    const data = {
      ...buildNotificationData(values),
      notificationType: NotificationTypes.Webhook,
      fields: [
        { name: 'json', value: values.json },
      ],
    };

    return postNotifications(data)
      .then(({ notificationId }) => {
        if (notificationId) {
          setValue('notificationId', notificationId);
        }
        enqueueSnackbar('Notification saved', { variant: 'success' });
      })
      .catch(() => enqueueSnackbar('Failed to create/update notification', { variant: 'error' }));
  }, [enqueueSnackbar, setError, setValue]);

  return (
    <Paper>
      <Box sx={{
        p: 4,
      }}
      >
        <NotificationsForm onSubmit={handleSubmit(onSubmit)}>
          <FlexLayout>
            <NotificationTypeText>JSON webhook</NotificationTypeText>

            <ConfirmProvider>
              <DeleteNotificationButton control={control} />
            </ConfirmProvider>
          </FlexLayout>
          <NameInput control={control} />
          <CollapsableLayout defaultExpanded={defaultExpanded}>
            <FlexLayout>
              <Box sx={{
                flexGrow: 1,
                mr: 4,
                flexFlow: 'row',
              }}
              >
                <NotificationIdField />

                <TextFieldElement
                  control={control}
                  variant='outlined'
                  margin='normal'
                  required
                  name='destination'
                  label='Webhook url'
                  fullWidth
                />

                <MangaSelector<JsonFormValues>
                  control={control}
                  name='manga'
                  label='Manga updates to notify on'
                  sx={{
                    mt: 2,
                    mb: 2,
                    mr: 2,
                    flexGrow: 1,
                  }}
                />

                <FormControl error={Boolean(jsonError)} sx={{ width: '100%' }} required>
                  <FormLabel>Webhook json format</FormLabel>
                  <CodeMirror
                    value={jsonValue}
                    minHeight='100px'
                    extensions={[
                      json(),
                    ]}
                    theme='dark'
                    onChange={jsonOnChange}
                  />
                  <FormHelperText>{jsonError?.message}</FormHelperText>
                </FormControl>

                <SaveButton
                  submitting={isSubmitting}
                />
              </Box>
              <RightSide control={control}>
                <div style={{ minHeight: '5%' }} />
                Formatting help
                <br />
                <br />
                <DefaultHelpTexts />
              </RightSide>
            </FlexLayout>
          </CollapsableLayout>
        </NotificationsForm>
      </Box>
    </Paper>
  );
};

export default WebhookEditor;
