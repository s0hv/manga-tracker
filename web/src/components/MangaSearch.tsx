import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import {
  type AutocompleteProps,
  type InputBaseClasses,
  type PopperProps,
  Box,
  IconButton,
  InputBase,
  Popper,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { alpha, styled } from '@mui/material/styles';
import { throttle } from 'es-toolkit';
import { useRouter } from 'next/router';

import { showAll } from '@/components/notifications/utilities';
import type { SearchedManga } from '@/types/api/manga';

import { quickSearch } from '../api/manga';

type RenderListOption = NonNullable<AutocompleteProps<SearchedManga, false, false, true>['renderOption']>;

const PREFIX = 'MangaSearch';
const classes = {
  root: `${PREFIX}-root`,
  search: `${PREFIX}-search`,
  inputInput: `${PREFIX}-inputInput`,
  popper: `${PREFIX}-popper`,
};

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

const ListItem = styled('div')({
  width: '100%',
});


export type MangaSearchProps = {
  placeholder?: string
  renderItem?: RenderListOption
  inputClasses?: Partial<InputBaseClasses>
  popperProps?: PopperProps
  clearOnClick?: boolean
  ariaLabel?: string
  onChange?: (manga: SearchedManga) => Promise<unknown> | unknown
  id?: string
  searchThrottleTimeout?: number
};
export default function MangaSearch(props: MangaSearchProps) {
  const {
    placeholder = 'Search…',
    renderItem,
    inputClasses = {},
    popperProps = {},
    id = 'manga-search',
    ariaLabel = 'manga search',
    clearOnClick = true,
    onChange: onChangeFunc,
    searchThrottleTimeout = 200,
  } = props;

  const [value, setValue] = useState('');
  const [options, setOptions] = useState<SearchedManga[]>([]);
  const router = useRouter();

  const onChangeDefault = useCallback(
    (newValue: SearchedManga) => router.push(`/manga/${newValue.mangaId}`),
    [router]
  );
  const onChange = onChangeFunc || onChangeDefault;

  const handleChange = useCallback((_: unknown, newValue: string) => {
    setValue(newValue);
  }, []);

  const handleValueChange = useCallback((_: unknown, newValue: string | SearchedManga | null) => {
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
    () => throttle((query: string, cb: (manga: SearchedManga[]) => void) => {
      quickSearch(query)
        .then(js => cb(js));
    }, searchThrottleTimeout, { edges: ['leading']}),
    [searchThrottleTimeout]
  );

  useEffect(() => {
    let active = true;
    if (value.length < 2) {
      setOptions([]);
      return undefined;
    }

    throttleFetch(value, results => {
      if (active) {
        setOptions(results || []);
      }
    });

    return () => {
      active = false;
    };
  }, [value, throttleFetch]);

  const defaultRenderListOption = useCallback<RenderListOption>(({ key, ...renderProps }, option) => (
    <Box key={key} component='li' {...renderProps}>
      <ListItem>{option.title}</ListItem>
    </Box>
  ), []);

  const renderListOption = renderItem || defaultRenderListOption;

  const BottomEndPopper = useCallback((pProps: PopperProps) => (
    <Popper {...pProps} placement='bottom-end' {...popperProps}>
      {pProps.children}
    </Popper>
  ), [popperProps]);

  return (
    <StyledAutocomplete
      options={options}
      renderOption={renderListOption}
      clearOnBlur={false}
      getOptionLabel={(option => (typeof option === 'string' ? option : option.title))}
      filterOptions={showAll} // Always render all options
      id={id}
      value={null}
      onChange={handleValueChange}
      slots={{
        popper: BottomEndPopper,
      }}
      onInputChange={handleChange}
      inputValue={value}
      freeSolo
      openOnFocus
      fullWidth
      classes={{
        popper: classes.popper,
      }}
      renderInput={params => (
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
      )}
    />
  );
}
