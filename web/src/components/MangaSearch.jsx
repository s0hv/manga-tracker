import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconButton, InputBase, Popper } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import Autocomplete from '@mui/material/Autocomplete';
import PropTypes from 'prop-types';

import { Search as SearchIcon } from '@mui/icons-material';

import throttle from 'lodash.throttle';
import { useRouter } from 'next/router';
import { quickSearch } from '../api/manga';

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
}));

const ListItem = styled('div')({
  width: '100%',
});


export default function MangaSearch(props) {
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
  const [options, setOptions] = useState([]);
  const router = useRouter();

  const onChangeDefault = useCallback(
    (newValue) => router.push(`/manga/${newValue.mangaId}`),
    [router]
  );
  const onChange = onChangeFunc || onChangeDefault;

  const handleChange = useCallback((event, newValue) => {
    setValue(newValue);
  }, []);

  const handleValueChange = useCallback((e, newValue) => {
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
    return onChange(newValue);
  }, [clearOnClick, onChange, options]);

  const throttleFetch = useMemo(
    () => throttle((query, cb) => {
      quickSearch(query)
        .then(js => cb(js));
    }, searchThrottleTimeout, { trailing: false }),
    [searchThrottleTimeout]
  );

  useEffect(() => {
    let active = true;
    if (value.length < 2) {
      setOptions([]);
      return undefined;
    }

    throttleFetch(value, (results) => {
      if (active) {
        setOptions(results || []);
      }
    });

    return () => {
      active = false;
    };
  }, [value, throttleFetch]);

  const defaultRenderListOption = useCallback((renderProps, option) => (
    <li {...renderProps}>
      <ListItem>{option.title}</ListItem>
    </li>
  ), []);

  const renderListOption = renderItem || defaultRenderListOption;

  const BottomEndPopper = useCallback((pProps) => (
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
      filterOptions={(o) => o} // Always render all options
      id={id}
      value={null}
      onChange={handleValueChange}
      PopperComponent={BottomEndPopper}
      onInputChange={handleChange}
      inputValue={value}
      freeSolo
      openOnFocus
      fullWidth
      classes={{
        popper: classes.popper,
      }}
      renderInput={(params) => (
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

MangaSearch.propTypes = {
  placeholder: PropTypes.string,
  renderItem: PropTypes.func,
  inputClasses: PropTypes.object,
  popperProps: PropTypes.object,
  clearOnClick: PropTypes.bool,
  ariaLabel: PropTypes.string,
  onChange: PropTypes.func,
};
