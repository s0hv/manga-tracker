import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Paper } from '@mui/material';
import { ConfirmProvider } from 'material-ui-confirm';
import dynamic from 'next/dynamic';
import { useSnackbar } from 'notistack';
import {
  type Control,
  type FormState,
  type SubmitHandler,
  useForm,
} from 'react-hook-form';
import { TextFieldElement, useWatch } from 'react-hook-form-mui';

import {
  FormContextRefProvider,
  useFormContextRefValue,
} from '@/components/hooks/useFormContextRef';
import {
  type MangaOverrideSelectorProps,
  ChangeOverride,
} from '@/components/notifications/MangaOverrideSelector';
import type { FormValues } from '@/components/notifications/types';
import type {
  NotificationData,
  NotificationField,
} from '@/types/api/notifications';
import { NotificationTypes } from '@/webUtils/constants';
import {
  type MappedNotificationField,
  buildNotificationData,
  mapNotificationFields,
} from '@/webUtils/utilities';


import {
  postNotificationOverride,
  postNotifications,
} from '../../api/notifications';

import ColorPicker from './ColorPicker';
import DefaultHelpTexts from './DefaultHelpTexts';
import DeleteNotificationButton from './DeleteNotificationButton';
import FormatHelpText from './FormatHelpText';
import {
  CollapsableLayout,
  FlexLayout,
  NotificationTypeText,
  RightSide,
} from './Layout';
import MangaSelector from './MangaSelector';
import { NameInput } from './NameInput';
import NotificationsForm from './NotificationsForm';
import SaveButton from './SaveButton';

type FieldTypes = {
  username: string | undefined | null
  embed_title: string | undefined | null
  message: string | undefined | null
  url: string | undefined | null
  avatar_url: string | undefined | null
  embed_content: string | undefined | null
  footer: string | undefined | null
  thumbnail: string | undefined | null
  color: string | undefined | null
};
interface DiscordFormData extends FormValues, FieldTypes {}

const MangaOverrideSelector = dynamic(() => import('./MangaOverrideSelector')) as unknown as FC<MangaOverrideSelectorProps<DiscordFormData>>;

export type DiscordWebhookEditorProps = {
  notificationData: NotificationData
  defaultExpanded: boolean
};

const getFields = (values: DiscordFormData) => [
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


const getNotificationFields = (override: number | null | undefined, notificationData: NotificationData): NotificationField[] => {
  if (override == null) return notificationData.fields;

  const fields = notificationData.overrides[override];
  return fields || [];
};

const getInitialValues = (notificationData: NotificationData, notificationFields: NotificationField[]): Partial<DiscordFormData> => ({
  notificationId: notificationData.notificationId,
  destination: notificationData.destination,
  disabled: notificationData.disabled,
  groupByManga: notificationData.groupByManga,
  name: notificationData.name,
  useFollows: notificationData.useFollows,
  manga: notificationData.manga,
  ...mapNotificationFields<FieldTypes>(notificationFields),
});

const mapOverrides = (notificationData: NotificationData) => new Set(Object.keys(notificationData.overrides).map(v => Number(v)));

type FormComponentProps = {
  defaultExpanded: boolean
  overrides: Set<number>
  fieldRequired: MappedNotificationField<boolean>
  changeOverride: ChangeOverride
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>
  control: Control<DiscordFormData>
  formState: FormState<DiscordFormData>
};

const FormComponent: FC<FormComponentProps> = (
  {
    defaultExpanded,
    overrides,
    fieldRequired,
    changeOverride,
    onSubmit,
    control,
    formState,
  }
) => {
  const {
    isSubmitting,
    isValid,
  } = formState;

  const override = useWatch({ name: 'overrideId', control });
  const isOverride = typeof override === 'number';

  return (
    <NotificationsForm onSubmit={onSubmit} noValidate>
      <FlexLayout>
        <NotificationTypeText>Discord webhook</NotificationTypeText>
        <DeleteNotificationButton disabled={isOverride} control={control} />
      </FlexLayout>

      <NameInput disabled={isOverride} control={control} />

      <CollapsableLayout defaultExpanded={defaultExpanded}>
        <FlexLayout>
          <Box sx={{
            mr: 4,
          }}
          >

            <TextFieldElement
              variant='outlined'
              margin='normal'
              name='destination'
              control={control}
              label='Webhook url'
              disabled={isOverride}
              required
              fullWidth
            />

            <MangaSelector
              control={control}
              name='manga'
              label='Manga updates to notify on'
              sx={{
                mt: 2,
                mb: 1,
                mr: 2,
                flexGrow: 1,
              }}
              disabled={isOverride}
            />

            <MangaOverrideSelector
              control={control}
              name='overrideId'
              label='Manga override'
              overrides={overrides}
              changeOverride={changeOverride}
              sx={{
                mt: 2,
                mb: 1,
                mr: 2,
                flexGrow: 1,
              }}
            />

            <TextFieldElement
              variant='outlined'
              margin='normal'
              autoComplete='off'
              required={!isOverride && fieldRequired.username}
              name='username'
              control={control}
              label='Webhook username'
              fullWidth
            />
            <TextFieldElement
              variant='outlined'
              margin='normal'
              required={!isOverride && fieldRequired.embed_title}
              name='embed_title'
              control={control}
              label='Embed title'
              fullWidth
            />
            <TextFieldElement
              variant='outlined'
              margin='normal'
              multiline
              required={!isOverride && fieldRequired.message}
              name='message'
              control={control}
              label='Message'
              fullWidth
            />
            <TextFieldElement
              variant='outlined'
              margin='normal'
              required={!isOverride && fieldRequired.url}
              name='url'
              control={control}
              label='Embed url'
              fullWidth
            />
            <TextFieldElement
              variant='outlined'
              margin='normal'
              required={!isOverride && fieldRequired.avatar_url}
              name='avatar_url'
              control={control}
              label='Webhook user avatar url'
              fullWidth
            />
            <TextFieldElement
              variant='outlined'
              margin='normal'
              required={!isOverride && fieldRequired.embed_content}
              name='embed_content'
              control={control}
              label='Embed content'
              fullWidth
              multiline
            />
            <TextFieldElement
              variant='outlined'
              margin='normal'
              required={!isOverride && fieldRequired.footer}
              name='footer'
              control={control}
              label='Footer content'
              fullWidth
            />
            <TextFieldElement
              variant='outlined'
              margin='normal'
              required={!isOverride && fieldRequired.thumbnail}
              name='thumbnail'
              control={control}
              label='Embed thumbnail'
              fullWidth
            />
            <ColorPicker<DiscordFormData>
              control={control}
              sx={{
                mt: 2,
              }}
              name='color'
              label='Embed color'
            />

            <SaveButton
              submitting={isSubmitting}
              hasValidationErrors={!isValid}
            />
          </Box>
          <RightSide disabled={isOverride} control={control}>
            <div style={{ height: '10%' }} />
            <Box sx={{
              minWidth: 'min-content',
            }}
            >
              Formatting help
              <br />
              <br />
              <DefaultHelpTexts />
              <br />
              { }
              Only the following formatting is available for "Username" and "Message"
              {' '}
              <br />
              <br />
              <FormatHelpText
                name='$MANGA_TITLES'
                description='Comma separated list of all unique manga titles contained in the notification'
              />
            </Box>
          </RightSide>
        </FlexLayout>
      </CollapsableLayout>
    </NotificationsForm>
  );
};


const DiscordWebhookEditor: React.FC<DiscordWebhookEditorProps> = ({
  notificationData: notificationDataProp,
  defaultExpanded = false,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [notificationData, setNotificationData] = useState<NotificationData>(notificationDataProp);
  const [overrides, setOverrides] = useState<Set<number>>(mapOverrides(notificationData));
  const [newFormData, setNewFormData] = useState<{
    notificationData?: NotificationData
    overrideId: number | null
  }>({ overrideId: null });

  const notificationFields = useMemo<NotificationField[]>(() => getNotificationFields(null, notificationData),
    [notificationData]);

  const initialValues: Partial<DiscordFormData> = useMemo(() => getInitialValues(notificationData, notificationFields),
    [notificationData, notificationFields]);

  const fieldRequired = useMemo<Record<keyof FieldTypes, boolean>>(() => {
    const mapped = mapNotificationFields<FieldTypes, 'optional'>(notificationData.fields, 'optional');
    (Object.keys(mapped) as Array<keyof FieldTypes>)
      .forEach(key => {
        mapped[key] = !mapped[key];
      });

    return mapped;
  },
  [notificationData.fields]);

  const methods = useForm<DiscordFormData>({
    defaultValues: initialValues,
    mode: 'onBlur',
  });
  const {
    control,
    reset,
    setValue,
    handleSubmit,
    formState,
    trigger,
    register,
  } = methods;

  const formRef = useFormContextRefValue({ setValue, control });

  const onSubmit = useCallback<SubmitHandler<DiscordFormData>>((values: DiscordFormData) => {
    const isOverride = typeof values.overrideId === 'number';

    let resp: Promise<NotificationData>;

    if (isOverride) {
      const data = {
        notificationType: NotificationTypes.DiscordWebhook,
        notificationId: values.notificationId,
        overrideId: values.overrideId,
        fields: getFields(values),
      };

      resp = postNotificationOverride(data);
    } else {
      const data = {
        ...buildNotificationData(values),
        notificationType: NotificationTypes.DiscordWebhook,
        fields: getFields(values),
      };

      resp = postNotifications(data);
    }

    return resp
      .then(newData => {
        setNotificationData(newData);
        setNewFormData({
          notificationData: newData,
          overrideId: values.overrideId,
        });
        setOverrides(mapOverrides(newData));
        const msg = isOverride ? 'Notification override saved' : 'Notification saved';
        enqueueSnackbar(msg, { variant: 'success' });
      })
      .catch(() => {
        const msg = isOverride ? 'Failed to create/update notification override' : 'Failed to create/update notification';
        enqueueSnackbar(msg, { variant: 'error' });
      });
  }, [enqueueSnackbar]);

  const changeOverride = useCallback<ChangeOverride>((overrideId: number | null) => {
    reset({
      ...(overrideId !== null ? Object.fromEntries(Object.keys(fieldRequired).map(key => [key, null])) : {}),
      ...getInitialValues(notificationData, getNotificationFields(overrideId, notificationData)),
      overrideId,
    });

    if (overrideId === null) {
      (Object.entries(fieldRequired) as Array<[keyof FieldTypes, boolean]>)
        .forEach(([name, required]) => register(name, { required }));
    } else {
      (Object.keys(fieldRequired) as Array<keyof FieldTypes>)
        .forEach(name => register(name, { required: false }));
    }

    trigger();
  }, [notificationData, register, reset, trigger, fieldRequired]);

  // Form reset is recommended to be done in the useEffect
  useEffect(() => {
    const newData = newFormData.notificationData;
    if (!newData) return;

    reset(getInitialValues(newData, getNotificationFields(newFormData.overrideId, newData)));
    setValue('overrideId', newFormData.overrideId);
  }, [newFormData, reset, setValue]);

  return (
    <Paper>
      <Box sx={{
        p: 4,
        m: 2,
        minWidth: '800px',
      }}
      >
        <ConfirmProvider>
          <FormContextRefProvider value={formRef}>
            <FormComponent
              defaultExpanded={defaultExpanded}
              changeOverride={changeOverride}
              overrides={overrides}
              fieldRequired={fieldRequired}
              onSubmit={handleSubmit(onSubmit)}
              control={control}
              formState={formState}
            />
          </FormContextRefProvider>
        </ConfirmProvider>
      </Box>
    </Paper>
  );
};

export default DiscordWebhookEditor;
