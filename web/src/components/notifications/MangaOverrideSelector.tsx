import { Autocomplete } from 'mui-rff';
import { useQuery } from '@tanstack/react-query';
import { FC, SyntheticEvent, useCallback, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import { useField, useForm, useFormState } from 'react-final-form';
import type { AutocompleteProps } from 'mui-rff/src/Autocomplete';
import { useConfirm } from 'material-ui-confirm';
import type { NotificationFollow } from '@/types/api/notifications';
import { QueryKeys } from '@/webUtils/constants';
import { getNotificationFollows } from '../../api/notifications';
import {
  getOptionLabel,
  groupByKey,
  noData,
  optionEquals,
  showAll,
} from '@/components/notifications/utilities';

type AutocompleteType = AutocompleteProps<NotificationFollow, false, false, false>;
type MangaOverrideSelectorProps = {
  name: string,
  label: string,
  useFollowsName: string,
  overrides: Set<number>
  setOverride: (override: number | null) => void,
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
  setOverride,
  overrides,
  ...autocompleteProps
}) => {
  const [query, setQuery] = useState('');
  const [value, setValue] = useState<NotificationFollow | null>(null);
  const form = useForm();
  const confirm = useConfirm();
  const { dirtyFields } = useFormState({ subscription: { dirtyFields: true }});

  const onInputChange = useCallback((e: SyntheticEvent, val: string | null) => {
    const inputValue = val;
    if (typeof inputValue === 'string') {
      setQuery(inputValue);
    }
  }, []);

  const onValueChange = useCallback((_: any, v: NotificationFollow | null) => {
    const dirtyCount = Object.entries(dirtyFields).filter(([field, dirty]) => (field !== name && !allowedChangeFields.has(field)) && dirty).length;
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
          setOverride(v?.mangaId ?? null);
          form.restart();
        })
        .catch(() => {});
    } else {
      setValue(v);
      setOverride(v?.mangaId ?? null);
    }
  }, [dirtyFields, name, confirm, setOverride, form]);

  const { input: useFollowsInput } = useField(useFollowsName);
  const { input: selectedManga } = useField('manga');

  const useFollows = typeof useFollowsInput.value === 'boolean' ? useFollowsInput.value : false;
  const renderOption = useCallback((props: object, option: NotificationFollow) => {
    return (
      // eslint-disable-next-line jsx-a11y/role-supports-aria-props
      <li {...props} aria-selected={overrides.has(option.mangaId) ? 'true' : 'false'}>
        {getOptionLabel(option)}
      </li>
    );
  }, [overrides]);

  const { data } = useQuery(QueryKeys.NotificationFollows, getNotificationFollows, {
    placeholderData: () => [],
    keepPreviousData: true,
    staleTime: 1000*30,
  });

  const options = useMemo<NotificationFollow[]>(() => (useFollows ? data : selectedManga.value),
    [useFollows, data, selectedManga.value]);

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
    }}
    >
      <Autocomplete
        label={label}
        name={name}
        options={options || noData}
        value={value}
        renderOption={renderOption}
        inputValue={query}
        onInputChange={onInputChange}
        onChange={onValueChange}
        filterOptions={showAll}
        groupBy={groupByKey}
        getOptionLabel={getOptionLabel}
        isOptionEqualToValue={optionEquals}
        {...autocompleteProps}
      />
    </Box>
  );
};


export default MangaOverrideSelector;
