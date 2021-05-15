import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconButton, InputBase, Popper, } from '@material-ui/core';
import { fade, makeStyles } from '@material-ui/core/styles';
import Autocomplete from '@material-ui/lab/Autocomplete';
import PropTypes from 'prop-types';

import { Search as SearchIcon } from '@material-ui/icons';

import throttle from 'lodash.throttle';
import { useRouter } from 'next/router';

const useStyles = makeStyles((theme) => ({
  search: {
    position: 'relative',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: fade(theme.palette.common.white, 0.15),
    '&:hover': {
      backgroundColor: fade(theme.palette.common.white, 0.25),
    },
    width: 'auto',
    [theme.breakpoints.down(400)]: {

    },
  },
  inputRoot: {
    color: 'inherit',
  },
  inputInput: {
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
  popper: {
    zIndex: theme.zIndex.modal,
    marginTop: '10px',
    width: '200px !important',
    [theme.breakpoints.up('sm')]: {
      width: '450px !important',
    },
  },
  listItem: {
    width: '100%',
  },
}));


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
  } = props;

  const [value, setValue] = useState('');
  const [options, setOptions] = useState([]);
  const classes = useStyles();
  const router = useRouter();

  const onChangeDefault = useCallback(
    (newValue) => router.push(`/manga/${newValue.manga_id}`),
    [router]
  );
  const onChange = onChangeFunc || onChangeDefault;

  const handleChange = useCallback((event, newValue) => {
    setValue(newValue);
  }, []);

  const handleValueChange = useCallback((e, newValue) => {
    if (clearOnClick) {
      setValue('');
    }
    return onChange(newValue);
  }, [clearOnClick, onChange]);

  const throttleFetch = useMemo(
    () => throttle((query, cb) => {
      fetch('/api/quicksearch?query=' + encodeURIComponent(query))
        .then(res => res.json())
        .then(js => cb(js))
        .catch(err => {
          console.error(err);
          cb(null);
        });
    }, 200),
    []
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

  const defaultRenderListOption = useCallback((option) => (
    <div className={classes.listItem}>{option.title}</div>
  ), [classes.listItem]);

  const renderListOption = renderItem || defaultRenderListOption;

  const BottomEndPopper = useCallback((pProps) => (
    <Popper {...pProps} placement='bottom-end' {...popperProps}>
      {pProps.children}
    </Popper>
  ), [popperProps]);

  return (
    <Autocomplete
      options={options}
      renderOption={renderListOption}
      clearOnBlur={false}
      getOptionLabel={(option => option.title)}
      filterOptions={(o) => o}
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
        root: classes.search,
      }}
      renderInput={(params) => (
        <InputBase
          aria-label={ariaLabel}
          inputProps={params.inputProps}
          ref={params.InputProps.ref}
          placeholder={placeholder}
          classes={{
            input: classes.inputInput,
            root: classes.inputRoot,
            ...inputClasses,
          }}
          endAdornment={(
            <IconButton>
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
