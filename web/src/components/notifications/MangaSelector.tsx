import { type SyntheticEvent, useCallback, useState } from 'react';
import { AutocompleteProps, Box } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
  type Control,
  type FieldPath,
  type FieldPathByValue,
  type Validate,
} from 'react-hook-form';
import {
  AutocompleteElement,
  CheckboxElement,
  useWatch,
} from 'react-hook-form-mui';

import type { FormValues } from '@/components/notifications/types';
import {
  getOptionLabel,
  groupByKey,
  noData,
  optionEquals,
  showAll,
} from '@/components/notifications/utilities';
import type { NotificationFollow } from '@/types/api/notifications';


import { quickSearch } from '../../api/manga';

type AutocompleteType = AutocompleteProps<NotificationFollow, true, false, false>;
export type MangaSelectorProps<TFieldValues extends FormValues = FormValues> = {
  control?: Control<TFieldValues>
  name: FieldPathByValue<TFieldValues, NotificationFollow[] | null>
  label: string
  disabled?: boolean
} & Omit<AutocompleteType, 'label' | 'options' | 'renderInput' | 'name'>;

const MangaSelector = <TFieldValues extends FormValues = FormValues>({
  control: controlUntyped,
  name,
  label,
  disabled,
  ...autocompleteProps
}: MangaSelectorProps<TFieldValues>) => {
  const control = controlUntyped as unknown as Control<FormValues>;

  const [query, setQuery] = useState('');
  const useFollows = useWatch({ name: 'useFollows', control });

  const doSearch = useCallback(async ({ queryKey }: { queryKey: string[] }): Promise<NotificationFollow[]> => {
    const searchQuery = queryKey[1]?.trim();
    if (searchQuery?.length < 2) return [];

    return quickSearch(searchQuery, true)
      .then(rows => {
        if (!rows) return [];
        return rows.reduce<NotificationFollow[]>((prev, row) => [
          ...prev,
          {
            ...row,
            serviceId: null,
            serviceName: 'All services',
          },
          ...Object.entries(row.services)
            .map(([serviceId, serviceName]) => ({
              ...row,
              serviceId: Number(serviceId),
              serviceName,
            })),
        ], []);
      });
  }, []);

  const { data } = useQuery({
    queryKey: ['search-notif', query],
    queryFn: doSearch,
  });

  const onInputChange = useCallback((_: SyntheticEvent, value: string | null) => {
    if (typeof value === 'string') {
      setQuery(value);
    }
  }, []);

  const onValueChange = useCallback((_: any) => {
    setQuery(query);
  }, [query]);

  const hasError = useCallback<Validate<NotificationFollow[] | null, FormValues>>(
    (value, allValues) => {
      const currentUseFollows = allValues ? allValues.useFollows : false;
      if (currentUseFollows ? false : !((value?.length ?? 0) > 0)) {
        return 'Must select at least one manga or use follows';
      }
    },
    []
  );

  const autocompleteDisabled = disabled || (typeof useFollows === 'boolean' ? useFollows : false);

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
    }}
    >
      <AutocompleteElement
        control={control}
        label={label}
        name={name}
        options={data ?? noData}
        rules={{ validate: hasError as Validate<any, any> }}
        transform={{
          input: v => (v ?? []) as NotificationFollow[],
        }}
        multiple
        autocompleteProps={{
          limitTags: 3,
          inputValue: query,
          onInputChange: onInputChange,
          onChange: onValueChange,
          filterOptions: showAll,
          groupBy: groupByKey,
          getOptionLabel: getOptionLabel,
          isOptionEqualToValue: optionEquals,
          disableCloseOnSelect: true,
          clearOnBlur: false,
          fullWidth: false,
          disabled: autocompleteDisabled,
          ...autocompleteProps,
        }}
      />
      OR
      <CheckboxElement
        control={control}
        labelProps={{
          sx: {
            ml: 1,
            flex: 'none',
          },
        }}
        name={'useFollows' as FieldPath<TFieldValues>}
        color='primary'
        label='Use follows'
        disabled={disabled}
      />
    </Box>
  );
};

export default MangaSelector;
