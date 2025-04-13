import { Autocomplete } from 'mui-rff';
import { useQuery } from '@tanstack/react-query';
import { type FC, useCallback, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import { useField, useForm, useFormState } from 'react-final-form';
import type { AutocompleteProps } from 'mui-rff/src/Autocomplete';
import { useConfirm } from 'material-ui-confirm';
import type { FormApi } from 'final-form';
import type { NotificationFollow } from '@/types/api/notifications';
import { QueryKeys } from '@/webUtils/constants';
import { getNotificationFollows } from '../../api/notifications';
import {
  getOptionLabelNoService,
  noData,
  optionEquals,
} from '@/components/notifications/utilities';

export type ChangeOverride = (form: FormApi, overrideId: number | null) => void;
type AutocompleteType = AutocompleteProps<NotificationFollow, false, false, false>;
type MangaOverrideSelectorProps = {
  name: string,
  label: string,
  useFollowsName: string,
  overrides: Set<number>
  changeOverride: ChangeOverride
} & Omit<AutocompleteType,
  | 'name'
  | 'label'
  | 'options'
>

const allowedChangeFields = new Set(['notificationId', '_csrf']);

const MangaOverrideSelector: FC<MangaOverrideSelectorProps> = ({
  name,
  label,
  useFollowsName,
  overrides,
  changeOverride,
  ...autocompleteProps
}) => {
  const [value, setValue] = useState<NotificationFollow | null>(null);
  const form = useForm();
  const confirm = useConfirm();
  const { dirtyFields } = useFormState({ subscription: { dirtyFields: true }});

  const onValueChange = useCallback((_: any, v: NotificationFollow | null) => {
    const dirtyCount = Object.entries(dirtyFields).filter(([field, dirty]) => (field !== name && !allowedChangeFields.has(field)) && dirty).length;
    const overrideId = v?.mangaId ?? null;
    if (dirtyCount > 0) {
      confirm({
        description: 'You have unsaved changes. Do you want to discard changes?',
        confirmationText: 'Yes',
        cancellationText: 'No',
        confirmationButtonProps: { 'aria-label': 'Discard form changes' },
        cancellationButtonProps: { 'aria-label': 'Do not discard form changes' },
      })
        .then(() => {
          setValue(v);
          changeOverride(form, overrideId);
          form.change(name, overrideId);
        })
        .catch(() => {});
    } else {
      setValue(v);
      changeOverride(form, overrideId);
      form.change(name, overrideId);
    }
  }, [dirtyFields, name, confirm, form, changeOverride]);

  const { input: useFollowsInput } = useField(useFollowsName);
  const { input: selectedManga } = useField('manga');

  const useFollows = typeof useFollowsInput.value === 'boolean' ? useFollowsInput.value : false;
  const renderOption = useCallback((props: any, option: NotificationFollow) => {
    return (
      // eslint-disable-next-line jsx-a11y/role-supports-aria-props
      <li {...props} key={props.key as string} aria-selected={overrides.has(option.mangaId) ? 'true' : 'false'}>
        {getOptionLabelNoService(option)}
      </li>
    );
  }, [overrides]);

  const { data } = useQuery({
    queryKey: QueryKeys.NotificationFollows,
    queryFn: getNotificationFollows,
    placeholderData: () => [],
    staleTime: 1000*30,
  });

  const options = useMemo<NotificationFollow[]>(() => {
    const actualData: NotificationFollow[] = useFollows ? data : selectedManga.value;
    const foundManga: Set<number> = new Set();
    const filteredData: NotificationFollow[] = [];

    for (let i=0; i < actualData.length; i++) {
      const row = actualData[i];
      if (!foundManga.has(row.mangaId)) {
        filteredData.push(row);
        foundManga.add(row.mangaId);
      }
    }

    return filteredData;
  }, [useFollows, data, selectedManga.value]);

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
    }}
    >
      <Autocomplete
        label={label}
        name={name}
        options={options || noData as NotificationFollow[]}
        value={value}
        renderOption={renderOption}
        onChange={onValueChange}
        getOptionLabel={getOptionLabelNoService}
        isOptionEqualToValue={optionEquals}
        {...autocompleteProps}
      />
    </Box>
  );
};


export default MangaOverrideSelector;
