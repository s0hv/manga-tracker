import fetch from 'cross-fetch';
import React from 'react';
import {
  fade,
  IconButton,
  InputBase,
  makeStyles,
  Paper,
  Popper,
  setRef,
  unstable_useId as useId,
  useEventCallback,
} from '@material-ui/core';
import PropTypes from 'prop-types';

import {Search as SearchIcon} from '@material-ui/icons';

import NextLink from 'next/link';
import throttle from 'lodash/throttle';

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
  searchIcon: {
    display: 'flex',
    height: '100%',
    alignContent: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
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
  text: {
  },
  popper: {
    zIndex: theme.zIndex.modal,
    marginTop: '10px',
    width: '200px',
    [theme.breakpoints.up('sm')]: {
      width: '450px',
    },
  },
  listbox: {
    listStyle: 'none',
    margin: 0,
    padding: '8px 0px',
    overflow: 'auto',
  },
  paper: {
    ...theme.typography.body1,
    margin: '4px 0',
  },
  option: {
    minHeight: 48,
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
    cursor: 'pointer',
    paddingTop: 6,
    boxSizing: 'border-box',
    outline: '0',
    WebkitTapHighlightColor: 'transparent',
    paddingBottom: 6,
    paddingLeft: 16,
    paddingRight: 16,
    [theme.breakpoints.up('sm')]: {
      minHeight: 'auto',
    },
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '&[data-focus="true"]': {
      backgroundColor: theme.palette.action.hover,
    },
  },
}));

function useSearch(props) {
  const {
    options,
    id: idProp,
    open: popupOpen,
  } = props;

  const id = useId(idProp);
  const highlightedIndexRef = React.useRef(-1);
  const inputRef = React.useRef(null);
  const listboxRef = React.useRef(null);
  const [anchorEl, setAnchorEl] = React.useState(null);

  const setHighlightedIndex = useEventCallback((index) => {
    highlightedIndexRef.current = index;
    // does the index exist?
    if (index === -1) {
      inputRef.current.removeAttribute('aria-activedescendant');
    } else {
      inputRef.current.setAttribute('aria-activedescendant', `${id}-option-${index}`);
    }

    if (!listboxRef.current) {
      return;
    }

    const prev = listboxRef.current.querySelector('[data-focus]');
    if (prev) {
      prev.removeAttribute('data-focus');
    }

    const listboxNode = listboxRef.current.parentElement.querySelector('[role="listbox"]');

    // "No results"
    if (!listboxNode) {
      return;
    }

    if (index === -1) {
      listboxNode.scrollTop = 0;
      return;
    }

    const option = listboxRef.current.querySelector(`[data-option-index="${index}"]`);

    if (!option) {
      return;
    }

    option.setAttribute('data-focus', 'true');
  });

  const changeHighlightedIndex = useEventCallback((diff) => {
    if (!popupOpen) {
      return;
    }

    const getNextIndex = () => {
      const maxIndex = options.length - 1;

      if (diff === 'start' || diff === 'reset') {
        return -1;
      }

      if (diff === 'start') {
        return 0;
      }

      if (diff === 'end') {
        return maxIndex;
      }

      const newIndex = highlightedIndexRef.current + diff;

      if (newIndex < 0) {
        if (newIndex === -1) {
          return -1;
        }

        return maxIndex;
      }

      if (newIndex > maxIndex) {
        if (newIndex === maxIndex + 1) {
          return -1;
        }

        return 0;
      }

      return newIndex;
    };
    setHighlightedIndex(getNextIndex());
  });

  const handleListboxRef = useEventCallback((node) => {
    setRef(listboxRef, node);

    if (!node) {
      return;
    }

    // Automatically select the first option as the listbox become visible.
    if (highlightedIndexRef.current === -1) {
      changeHighlightedIndex('reset');
    } else {
      // Restore the focus to the correct option.
      setHighlightedIndex(highlightedIndexRef.current);
    }
  });

  const handleOptionMouseOver = (event) => {
    const index = Number(event.currentTarget.getAttribute('data-option-index'));
    setHighlightedIndex(index, 'mouse');
  };

  const handleKeyDown = (other) => (event) => {
    if (!popupOpen) return;

    switch (event.key) {
      case 'ArrowDown':
        // Prevent cursor move
        event.preventDefault();
        changeHighlightedIndex(1, 'next');
        break;
      case 'ArrowUp':
        // Prevent cursor move
        event.preventDefault();
        changeHighlightedIndex(-1, 'previous');
        break;
      case 'Enter':
        // No idea what this means. I copypasted this part
        // Wait until IME is settled.
        if (event.which === 229) {
          break;
        }

        // eslint-disable-next-line no-case-declarations
        const option = listboxRef.current.querySelector(`[data-option-index="${highlightedIndexRef.current}"]`);
        if (!option) {
          return;
        }

        option.click();
        break;
      case 'Escape':
        if (popupOpen) {
          // Avoid Opera to exit fullscreen mode.
          event.preventDefault();
          // Avoid the Modal to handle the event.
          event.stopPropagation();
        }
        break;
      default:
    }

    if (other.onKeyDown) {
      other.onKeyDown(event);
    }
  };

  return {
    getRootProps: (other = {}) => ({
       onKeyDown: handleKeyDown(other),
    }),

    getInputProps: () => ({
      id: id,
      spellCheck: false,
      ref: inputRef,
      autoComplete: 'off',
      autoCapitalize: 'none',
    }),

    getListboxProps: () => ({
      role: 'listbox',
      id: `${id}-popup`,
      'aria-labelledby': `${id}-label`,
      ref: handleListboxRef,
      onMouseDown: (event) => {
        // Prevent blur
        event.preventDefault();
      },
    }),
    getOptionProps: ({ index }) => ({
        key: index,
        tabIndex: -1,
        role: 'option',
        id: `${id}-option-${index}`,
        onMouseOver: handleOptionMouseOver,
        'data-option-index': index,
      }),
    id,
    anchorEl,
    setAnchorEl,
  };
}

export default function SearchInput(props) {
  const {
    placeholder = 'Search…',
    renderItem,
    inputClasses = {},
    popperProps = {},
    closeOnClick = false,
  } = props;
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState([]);
  const [inputValue, setInputValue] = React.useState('');

  const {
    getRootProps,
    getInputProps,
    getListboxProps,
    getOptionProps,
    id,
    anchorEl,
    setAnchorEl,
  } = useSearch({ ...props,
                        open: open && options.length > 0,
                        options,
  });

  const classes = useStyles();

  const handleChange = (event) => {
    setInputValue(event.target.value);
  };

  const throttleFetch = React.useMemo(
    () => throttle((query, cb) => {
        fetch('/api/quicksearch?query=' + encodeURIComponent(query))
          .then(res => res.json())
          .then(js => cb(js))
          .catch(cb(null));
      }, 200),
    [],
  );

  React.useEffect(() => {
    let active = true;
    if (inputValue.length < 3) {
      setOptions([]);
      setOpen(false);
      return undefined;
    }

    throttleFetch(inputValue, (results) => {
      if (active) {
        setOptions(results || []);
        setOpen(Boolean(results));
      }
    });

    return () => {
      active = false;
    };
  }, [inputValue, throttleFetch]);

  const renderListOption = renderItem ||
    ((option, index, titleProps) => (
      <li key={index}>
        <NextLink href='/manga/[id]' as={`/manga/${option.manga_id}`} prefetch={false}>
          <div {...titleProps}>{option.title}</div>
        </NextLink>
      </li>
      ));

  return (
    <div
      className={classes.search}
      ref={setAnchorEl}
      {...getRootProps()}
    >
      <InputBase
        id={id}
        onChange={handleChange}
        onBlur={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        classes={{
          root: classes.inputRoot,
          input: classes.inputInput,
          ...inputClasses,
        }}
        endAdornment={(
          <IconButton>
            <SearchIcon />
          </IconButton>
          )}
        inputProps={{
          'aria-label': 'search',
          ...getInputProps(),
        }}
      />
      {open && options.length > 0 && anchorEl ? (
        <Popper
          className={classes.popper}
          open
          placement='bottom-end'
          role='presentation'
          anchorEl={anchorEl}
          {...(closeOnClick && { onClick: () => setOpen(false) })}
          {...popperProps}
        >
          <Paper className={classes.paper}>
            <ul
              className={classes.listbox}
              {...getListboxProps()}
            >
              {options.map((option, index) => renderListOption(option, index, { ...getOptionProps({ index }), className: classes.option }))}
            </ul>
          </Paper>
        </Popper>
      ) : null}
    </div>
  );
}

SearchInput.propTypes = {
  placeholder: PropTypes.string,
  renderItem: PropTypes.func,
  // eslint-disable-next-line react/forbid-prop-types
  inputClasses: PropTypes.object,
  // eslint-disable-next-line react/forbid-prop-types
  popperProps: PropTypes.object,
  closeOnClick: PropTypes.bool,
};
