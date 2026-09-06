import React, { useCallback } from 'react';
import {
  type AutocompleteFreeSoloValueMapping,
  type AutocompleteProps,
  type AutocompleteValueOrFreeSoloValueMapping,
  CircularProgress,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type {
  Control,
  FieldPathByValue,
  FieldValues,
  UseFormSetValue,
} from 'react-hook-form';
import { AutocompleteElement } from 'react-hook-form-mui';

import { type SearchResultBasedOnServices, quickSearchQueryOptions } from '#web/api/manga';
import {
  useAutocompleteWithSearch,
} from '@/components/inputs/useAutocompleteWithSearch';
import { showAll } from '@/components/notifications/utilities';
import type { SearchedManga } from '@/types/api/manga';
import { noRows } from '@/webUtils/constants';


export type RenderListOption<TManga extends SearchedManga = SearchedManga> =
  NonNullable<AutocompleteProps<TManga, false, false, true>['renderOption']>;

const getOptionLabel = (
  option: SearchResultBasedOnServices<boolean> | AutocompleteFreeSoloValueMapping<true>
) => {
  return typeof option === 'string'
    ? option
    : option.title;
};

const isOptionEqualToValue = (
  option: SearchResultBasedOnServices<boolean>,
  value: AutocompleteValueOrFreeSoloValueMapping<SearchResultBasedOnServices<boolean>, true> | null
) => {
  if (typeof value === 'string' || value === null) {
    return false;
  }

  return option.mangaId === value.mangaId;
};

export type FormMangaSearchProps<TFieldValues extends FieldValues, TWithServices extends boolean = false> = {
  control: Control<TFieldValues>
  name: FieldPathByValue<TFieldValues, Omit<SearchedManga, 'score'> | null>
  setFieldValue: UseFormSetValue<TFieldValues>
  label?: string
  placeholder?: string
  renderItem?: RenderListOption<SearchResultBasedOnServices<TWithServices>>
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  onChange?: (manga: SearchResultBasedOnServices<TWithServices>) => Promise<unknown> | unknown
  id?: string
  searchThrottleTimeout?: number
  withServices?: TWithServices
  required?: boolean

  serviceId?: number
};

export const FormMangaSearch = <
  TFieldValues extends FieldValues,
  TWithServices extends boolean = false
>(props: FormMangaSearchProps<TFieldValues, TWithServices>) => {
  const {
    control,
    name,
    label,
    setFieldValue,
    placeholder = 'Search…',
    renderItem,
    id = 'manga-search',
    searchThrottleTimeout = 300,
    withServices = false,
    required,
    serviceId,
  } = props;

  const updateFieldValue = useCallback(
    (value: string): unknown => setFieldValue(
      name,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      {
        title: value,
      } satisfies Omit<SearchedManga, 'score' | 'mangaId'> | null as any
    ),
    [setFieldValue, name]
  );

  const {
    value: searchValue,
    defaultRenderListOption,
    onInputChange,
  } = useAutocompleteWithSearch<SearchResultBasedOnServices<TWithServices>>({
    getOptionLabel,
    setFieldValue: updateFieldValue,
    searchThrottleTimeout,
  });

  const {
    data,
    isFetching,
  } = useQuery(quickSearchQueryOptions(searchValue, withServices, serviceId));
  const options = (data ?? noRows) as unknown as SearchResultBasedOnServices<TWithServices>[];

  const renderListOption =
    renderItem
    ?? defaultRenderListOption as RenderListOption<SearchResultBasedOnServices<TWithServices>>;

  return (
    <AutocompleteElement
      control={control}
      name={name}
      label={label}
      options={options}
      required={required}
      loading={isFetching}
      loadingIndicator={<CircularProgress size={20} />}
      textFieldProps={{
        placeholder,
      }}
      autocompleteProps={{
        renderOption: renderListOption,
        clearOnBlur: false,
        getOptionLabel,
        // Always render all options
        filterOptions: showAll,
        isOptionEqualToValue,
        id,
        onInputChange,
        freeSolo: true,
        fullWidth: true,
        openOnFocus: true,
      }}
    />
  );
};
