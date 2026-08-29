import React, { useCallback, useMemo, useState } from 'react';
import { type AutocompleteProps, Box } from '@mui/material';
import { throttle } from 'es-toolkit';


export type FormMangaSearchProps<
  TOption,
> = {
  getOptionLabel: (option: TOption) => string
  // Callback to set the field value to the current search string.
  // This will always be called on change regardless of throttling.
  // Use it to keep your inputs in sync.
  setFieldValue: (option: string) => void
  searchThrottleTimeout?: number
  initialSearchValue?: string
};

export const useAutocompleteWithSearch = <TOption,>(props: FormMangaSearchProps<TOption>) => {
  const {
    getOptionLabel,
    setFieldValue,
    searchThrottleTimeout = 300,
    initialSearchValue,
  } = props;

  const [value, setValue] = useState(initialSearchValue ?? '');

  const throttleSetValue = useMemo(
    () => throttle(
      (newValue: string) => {
        setValue(newValue);
      },
      searchThrottleTimeout,
      { edges: ['trailing']}
    ),
    [searchThrottleTimeout]
  );


  const defaultRenderListOption = useCallback<
    NonNullable<AutocompleteProps<TOption, false, boolean, true>['renderOption']>
  >(
    ({ key, ...renderProps }, option) => (
      <Box key={key} component='li' {...renderProps}>
        <Box sx={{ width: '100%' }}>{getOptionLabel(option)}</Box>
      </Box>
    ), [getOptionLabel]
  );

  const onInputChange = useCallback((_: React.SyntheticEvent | undefined, value: string) => {
    if (value.length < 2) {
      setValue('');
      setFieldValue(value);
      return;
    }

    setFieldValue(value);
    throttleSetValue(value);
  }, [throttleSetValue, setFieldValue]);

  return {
    value,
    onInputChange,
    defaultRenderListOption,
  };
};
