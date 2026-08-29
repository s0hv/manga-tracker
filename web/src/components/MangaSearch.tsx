import React, { useCallback, useMemo, useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import {
  type AutocompleteFreeSoloValueMapping,
  type AutocompleteProps,
  type AutocompleteRenderInputParams, type AutocompleteSlots,
  type InputBaseClasses,
  type PopperProps,
  IconButton,
  InputBase,
  Popper,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { alpha, styled } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import {
  useAutocompleteWithSearch,
} from '@/components/inputs/useAutocompleteWithSearch';
import { showAll } from '@/components/notifications/utilities';
import type { SearchedManga } from '@/types/api/manga';
import { noRows } from '@/webUtils/constants';

import { type SearchResultBasedOnServices, quickSearchQueryOptions } from '../api/manga';

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
    searchThrottleTimeout = 300,
    withServices = false,
  } = props;

  const navigate = useNavigate();
  const [fieldValue, setFieldValue] = useState('');

  const onChangeDefault = useCallback(
    (newValue: SearchedManga) => navigate({ to: `/manga/$mangaId`, params: { mangaId: newValue.mangaId.toString() }}),
    [navigate]
  );
  const onChange = onChangeFunc ?? onChangeDefault;

  const {
    value,
    defaultRenderListOption,
    onInputChange: handleChange,
  } = useAutocompleteWithSearch<SearchResultBasedOnServices<TWithServices>>({
    getOptionLabel,
    setFieldValue,
    searchThrottleTimeout,
  });

  const {
    data,
  } = useQuery(quickSearchQueryOptions(value, withServices));
  const options = (data ?? noRows) as SearchResultBasedOnServices<TWithServices>[];

  const handleValueChange = useCallback((_: unknown, newValue: string | SearchResultBasedOnServices<TWithServices> | null) => {
    // If no option has been selected on change, use the first option
    if (typeof newValue === 'string') {
      if (options.length === 0) {
        return;
      }

      newValue = options[0];
    }
    if (clearOnClick) {
      setFieldValue('');
      handleChange(undefined, '');
    }
    if (!newValue) {
      return;
    }

    return onChange(newValue);
  }, [clearOnClick, handleChange, onChange, options]);

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
        'aria-label': ariaLabel,
        ...params.slotProps.htmlInput,
      }}
      id={params.id}
      onMouseDown={params.slotProps.input.onMouseDown}
      ref={params.slotProps.input.ref}
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
      inputValue={fieldValue}
      freeSolo
      openOnFocus
      fullWidth
      classes={autocompleteClasses}
      renderInput={renderInput}
    />
  );
};

export default MangaSearch;
