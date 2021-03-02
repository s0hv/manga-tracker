import React, { useCallback, useState } from 'react';
import {
  IconButton,
  InputBase,
  Popper,
} from '@material-ui/core';
import { fade, makeStyles } from '@material-ui/core/styles';
import Autocomplete from '@material-ui/lab/Autocomplete';
import PropTypes from 'prop-types';

import { Search as SearchIcon } from '@material-ui/icons';

import NextLink from 'next/link';
import throttle from 'lodash.throttle';

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
}));


export default function MangaSearch(props) {
  const {
    placeholder = 'Search…',
    renderItem,
    inputClasses = {},
    popperProps = {},
    id = 'manga-search',
  } = props;

  const [value, setValue] = useState('');
  const [options, setOptions] = useState([]);
  const classes = useStyles();

  const handleChange = useCallback((event) => {
    setValue(event.target.value);
  }, []);

  const throttleFetch = React.useMemo(
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

  React.useEffect(() => {
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

  const renderListOption = renderItem ||
    ((option) => (
      <NextLink href='/manga/[id]' as={`/manga/${option.manga_id}`} prefetch={false}>
        <div>{option.title}</div>
      </NextLink>
    ));

  const BottomEndPopper = (pProps) => (
    <Popper {...pProps} placement='bottom-end' {...popperProps}>
      {pProps.children}
    </Popper>
  );

  return (
    <Autocomplete
      options={options}
      renderOption={renderListOption}
      clearOnBlur={false}
      getOptionLabel={(option => option.title)}
      filterOptions={(o) => o}
      freeSolo
      openOnFocus
      fullWidth
      id={id}
      PopperComponent={BottomEndPopper}
      classes={{
        popper: classes.popper,
        root: classes.search,
      }}
      renderInput={(params) => (
        <InputBase
          aria-label='Manga search'
          inputProps={params.inputProps}
          ref={params.InputProps.ref}
          onChange={handleChange}
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
};
