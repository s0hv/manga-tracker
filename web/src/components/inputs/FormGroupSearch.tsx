import React, { useCallback, useMemo } from 'react';
import {
  type AutocompleteProps,
  type AutocompleteValueOrFreeSoloValueMapping,
  type SxProps,
  CircularProgress,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  type SetFieldValue, useWatch,
} from 'react-hook-form';
import { AutocompleteElement } from 'react-hook-form-mui';

import {
  useAutocompleteWithSearch,
} from '#components/inputs/useAutocompleteWithSearch';
import { showAll } from '#components/notifications/utilities';
import { searchGroupsQueryOptions } from '#web/api/group';
import { noRows } from '#webUtils/constants';
import type { SearchGroup } from '@/common/schemas/group';
import type { NullableExcept } from '@/types/utility';

type OptionType = NullableExcept<SearchGroup, 'name'>;

export type RenderListOption =
  NonNullable<AutocompleteProps<OptionType, false, false, true>['renderOption']>;

const getOptionLabel = (
  option: AutocompleteValueOrFreeSoloValueMapping<OptionType, true>
) => {
  return typeof option === 'string'
    ? option
    : option.name;
};

const isOptionEqualToValue = (
  option: OptionType,
  value: AutocompleteValueOrFreeSoloValueMapping<OptionType, true> | null
) => {
  if (typeof value === 'string' || value === null) {
    return option.name === value;
  }

  return option.name === value.name
    || option.groupId === value.groupId;
};


export type FormGroupSearchProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>
  name: FieldPathByValue<TFieldValues, OptionType | null>
  label?: string
  placeholder?: string
  renderItem?: RenderListOption
  id?: string
  searchThrottleTimeout?: number
  required?: boolean
  setFieldValue: SetFieldValue<TFieldValues>
  sx?: SxProps
};

export const FormGroupSearch = <
  TFieldValues extends FieldValues,
>(props: FormGroupSearchProps<TFieldValues>) => {
  const {
    control,
    name,
    label,
    placeholder = 'Search groups',
    renderItem,
    id = 'group-search',
    searchThrottleTimeout,
    required,
    setFieldValue,
    sx,
  } = props;

  const updateFieldValue = useCallback(
    (value: string) => setFieldValue(name, { name: value, groupId: null }),
    [setFieldValue, name]
  );

  const group: OptionType | null = useWatch({ control, name });

  const {
    value: groupName,
    defaultRenderListOption,
    onInputChange,
  } = useAutocompleteWithSearch<OptionType>({
    getOptionLabel,
    setFieldValue: updateFieldValue,
    searchThrottleTimeout,
    initialSearchValue: group?.name,
  });

  const {
    data,
    isFetching,
  } = useQuery(searchGroupsQueryOptions(groupName, 10));
  const options: OptionType[] | undefined = data;

  const renderListOption =
    renderItem
    ?? defaultRenderListOption as RenderListOption;

  const groupExists = useMemo(() => {
    if (!options) return false;

    if (group?.groupId) return true;

    return options.some(option => isOptionEqualToValue(option, group));
  }, [options, group]);

  return (
    <AutocompleteElement
      control={control}
      name={name}
      label={label}
      options={options ?? noRows}
      required={required}
      loading={isFetching}
      loadingIndicator={<CircularProgress size={20} />}
      textFieldProps={{
        placeholder,
        sx,
        helperText: !groupExists
          ? 'A new group will be created'
          : undefined,
      }}
      autocompleteProps={{
        renderOption: renderListOption,
        clearOnBlur: false,
        getOptionLabel,
        // Always render all options
        filterOptions: showAll,
        isOptionEqualToValue,
        id,
        onInputChange: onInputChange,
        freeSolo: true,
        fullWidth: true,
        openOnFocus: true,
      }}
    />
  );
};
