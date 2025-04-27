import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import {
  Autocomplete,
  type AutocompleteProps,
  Box,
  TextField,
} from '@mui/material';
import { useConfirm } from 'material-ui-confirm';
import {
  type Control,
  type FieldPathByValue,
  useController,
  useFormState,
  useWatch,
} from 'react-hook-form';
import type { NotificationFollow } from '@/types/api/notifications';
import { QueryKeys } from '@/webUtils/constants';
import { getNotificationFollows } from '../../api/notifications';
import {
  getOptionLabelNoService,
  noData,
  optionEquals,
} from '@/components/notifications/utilities';
import type { FormValues } from '@/components/notifications/types';


export type ChangeOverride = (overrideId: number | null) => void;
type AutocompleteType = AutocompleteProps<NotificationFollow, false, false, false>;
export type MangaOverrideSelectorProps<TFieldValues extends FormValues = FormValues> = {
  control: Control<TFieldValues>
  name: FieldPathByValue<TFieldValues, number | null>,
  label: string,
  overrides: Set<number>
  changeOverride: ChangeOverride
} & Omit<AutocompleteType, 'label' | 'options' | 'renderInput' | 'name'>;

const allowedChangeFields = new Set(['notificationId', '_csrf']);

const MangaOverrideSelector = <TFieldValues extends FormValues = FormValues>({
  control: controlUntyped,
  name,
  label,
  overrides,
  changeOverride,
  ...autocompleteProps
}: MangaOverrideSelectorProps<TFieldValues>) => {
  const control = controlUntyped as unknown as Control<FormValues>;
  const [value, setValue] = useState<NotificationFollow | null>(null);

  const confirm = useConfirm();
  const formState = useFormState({ control });

  const {
    field: {
      onChange,
      onBlur,
    },
  } = useController<FormValues, 'overrideId'>({
    control,
    name: name as 'overrideId',
  });

  const onValueChange = useCallback((_: any, v: NotificationFollow | null) => {
    console.log(formState.dirtyFields);
    // Use formState directly because we do not want to subscribe to changes
    const dirtyCount = Object.entries(formState.dirtyFields).filter(([field, dirty]) => (field !== name && !allowedChangeFields.has(field)) && dirty).length;
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
          onChange(overrideId);
          onBlur();
          changeOverride(overrideId);
        })
        .catch(() => {});
    } else {
      setValue(v);
      onChange(overrideId);
      onBlur();
      changeOverride(overrideId);
    }
  }, [formState, name, confirm, onChange, onBlur, changeOverride]);

  const useFollowsInput = useWatch({ name: 'useFollows', control });
  const selectedManga = useWatch({ name: 'manga', control });

  const useFollows = typeof useFollowsInput === 'boolean' ? useFollowsInput : false;
  const renderOption = useCallback<NonNullable<AutocompleteType['renderOption']>>((props, option) => {
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
    const actualData: NotificationFollow[] = useFollows ? (data ?? []) : selectedManga!;
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
  }, [useFollows, data, selectedManga]);

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
    }}
    >
      <Autocomplete<NotificationFollow, false, false, false>
        value={value as NotificationFollow | null}
        options={options || noData as NotificationFollow[]}
        renderInput={(params) => <TextField {...params} label={label} />}
        renderOption={renderOption}
        onChange={onValueChange}
        getOptionLabel={getOptionLabelNoService}
        isOptionEqualToValue={optionEquals}
        fullWidth
        {...autocompleteProps}
      />
    </Box>
  );
};


export default MangaOverrideSelector;
