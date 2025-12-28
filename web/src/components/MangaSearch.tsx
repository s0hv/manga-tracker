import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import {
  type AutocompleteFreeSoloValueMapping,
  type AutocompleteProps,
  type AutocompleteRenderInputParams, type AutocompleteSlots,
  type InputBaseClasses,
  type PopperProps,
  Box,
  IconButton,
  InputBase,
  Popper,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { alpha, styled } from '@mui/material/styles';
import { useNavigate } from '@tanstack/react-router';
import { throttle } from 'es-toolkit';

import { showAll } from '@/components/notifications/utilities';
import type { SearchedManga } from '@/types/api/manga';

import { type SearchResultBasedOnServices, quickSearch } from '../api/manga';

export type RenderListOption<TManga extends SearchedManga = SearchedManga> = NonNullable<AutocompleteProps<TManga, false, false, true>['renderOption']>;

const PREFIX = 'MangaSearch';
const classes = {
  root: `${PREFIX}-root`,
  search: `${PREFIX}-search`,
  inputInput: `${PREFIX}-inputInput`,
  popper: `${PREFIX}-popper`,
};

const autocompleteClasses = {
  popper: classes.popper,
} as const;

const StyledAutocomplete = styled(Autocomplete)(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  width: 'auto',
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },

  [`& .${classes.inputInput}`]: {
    width: '100%',
    marginLeft: '1em',
    transition: theme.transitions.create('width'),
    [theme.breakpoints.up('sm')]: {
      width: '16em',
      '&:focus': {
        width: '24em',
      },
    },
  },

  [`& .${classes.popper}`]: {
    zIndex: theme.zIndex.modal,
    marginTop: '10px',
    width: '200px !important',
    [theme.breakpoints.up('sm')]: {
      width: '450px !important',
    },
  },
})) as typeof Autocomplete;

const defaultRenderListOption: RenderListOption = ({ key, ...renderProps }, option) => (
  <Box key={key} component='li' {...renderProps}>
    <Box sx={{ width: '100%' }}>{option.title}</Box>
  </Box>
);

const getOptionLabel = (option: SearchResultBasedOnServices<boolean> | AutocompleteFreeSoloValueMapping<true>) => (typeof option === 'string' ? option : option.title);

const emptyObject = {};

export type MangaSearchProps<TWithServices extends boolean = false> = {
  placeholder?: string
  renderItem?: RenderListOption<SearchResultBasedOnServices<TWithServices>>
  inputClasses?: Partial<InputBaseClasses>
  popperProps?: Partial<PopperProps>
  clearOnClick?: boolean
  ariaLabel?: string
  onChange?: (manga: SearchResultBasedOnServices<TWithServices>) => Promise<unknown> | unknown
  id?: string
  searchThrottleTimeout?: number
  withServices?: TWithServices
};
const MangaSearch = <TWithServices extends boolean = false>(props: MangaSearchProps<TWithServices>) => {
  const {
    placeholder = 'Search…',
    renderItem,
    inputClasses = emptyObject,
    popperProps = emptyObject,
    id = 'manga-search',
    ariaLabel = 'manga search',
    clearOnClick = true,
    onChange: onChangeFunc,
    searchThrottleTimeout = 200,
    withServices = false,
  } = props;

  const [value, setValue] = useState('');
  const [options, setOptions] = useState<SearchResultBasedOnServices<TWithServices>[]>([]);
  const navigate = useNavigate();

  const onChangeDefault = useCallback(
    (newValue: SearchedManga) => navigate({ to: `/manga/$mangaId`, params: { mangaId: newValue.mangaId.toString() }}),
    [navigate]
  );
  const onChange = onChangeFunc ?? onChangeDefault;

  const handleChange = useCallback((_: unknown, newValue: string) => {
    setValue(newValue);
  }, []);

  const handleValueChange = useCallback((_: unknown, newValue: string | SearchResultBasedOnServices<TWithServices> | null) => {
    // If no option has been selected on change, use the first option
    if (typeof newValue === 'string') {
      if (options.length === 0) {
        return;
      }

      newValue = options[0];
    }
    if (clearOnClick) {
      setValue('');
    }
    if (!newValue) {
      return;
    }

    return onChange(newValue);
  }, [clearOnClick, onChange, options]);

  const throttleFetch = useMemo(
    () => throttle((query: string, cb: (manga: SearchResultBasedOnServices<TWithServices>[]) => void) => {
      quickSearch(query, withServices)
        .then(js => cb(js as SearchResultBasedOnServices<TWithServices>[]));
    }, searchThrottleTimeout, { edges: ['leading']}),
    [searchThrottleTimeout, withServices]
  );

  useEffect(() => {
    let active = true;
    if (value.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOptions([]);
      return undefined;
    }

    throttleFetch(value, results => {
      if (active) {
        setOptions((results ?? []));
      }
    });

    return () => {
      active = false;
    };
  }, [value, throttleFetch]);

  const renderListOption = renderItem || defaultRenderListOption as RenderListOption<SearchResultBasedOnServices<TWithServices>>;

  const BottomEndPopper = useCallback((pProps: PopperProps) => (
    <Popper {...pProps} placement='bottom-end' {...popperProps}>
      {pProps.children}
    </Popper>
  ), [popperProps]);

  const slots = useMemo<Partial<AutocompleteSlots>>(() => ({
    popper: BottomEndPopper,
  }), [BottomEndPopper]);

  const renderInput = useCallback((params: AutocompleteRenderInputParams) => (
    <InputBase
      inputProps={{
        ...params.inputProps,
        'aria-label': ariaLabel,
      }}
      ref={params.InputProps.ref}
      placeholder={placeholder}
      classes={{
        input: classes.inputInput,
        ...inputClasses,
      }}
      endAdornment={(
        <IconButton size='large'>
          <SearchIcon />
        </IconButton>
      )}
    />
  ), [ariaLabel, inputClasses, placeholder]);

  return (
    <StyledAutocomplete
      options={options}
      renderOption={renderListOption}
      clearOnBlur={false}
      getOptionLabel={getOptionLabel}
      filterOptions={showAll} // Always render all options
      id={id}
      value={null}
      onChange={handleValueChange}
      slots={slots}
      onInputChange={handleChange}
      inputValue={value}
      freeSolo
      openOnFocus
      fullWidth
      classes={autocompleteClasses}
      renderInput={renderInput}
    />
  );
};

export default MangaSearch;
