import { Autocomplete, Checkboxes } from 'mui-rff';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Box } from '@mui/material';
import { useField } from 'react-final-form';
import PropTypes from 'prop-types';
import { quickSearch } from '../../api/manga';

const showAll = o => o;
const noData = [];


const optionEquals = (option, value) => (
  option.mangaId === value.mangaId &&
  (value.serviceId === null || option.serviceId === value.serviceId)
);
const getOptionValue = option => ({ mangaId: option.mangaId, serviceId: option.serviceId });
const getOptionLabel = ({ title, serviceName }) => `${title} | ${serviceName}`;
const groupByKey = ({ mangaId, title }) => `${mangaId} ${title}`;

const MangaSelector = ({
  name,
  label,
  useFollowsName,
  ...autocompleteProps
}) => {
  const [query, setQuery] = useState('');
  const { input: mangaInput } = useField(name);
  const [values, setValues] = useState(mangaInput.value || []);

  const doSearch = useCallback(async ({ queryKey }) => {
    const searchQuery = queryKey[1]?.trim();
    if (searchQuery?.length < 2) return [];

    return quickSearch(searchQuery, true)
      .then(rows => {
        if (!rows) return;
        return rows.reduce((prev, row) => [
          ...prev,
          {
            ...row,
            serviceId: null,
            serviceName: 'All services',
          },
          ...Object.entries(row.services)
            .map(([serviceId, serviceName]) => ({
              ...row,
              serviceId,
              serviceName,
            })),
        ], []);
      });
  }, []);

  const { data } = useQuery(['search-notif', query], doSearch, {
    placeholderData: () => [],
    keepPreviousData: true,
  });

  const onInputChange = useCallback((e) => {
    const value = e?.target.value;
    if (typeof value === 'string') {
      setQuery(value);
    }
  }, []);

  const onValueChange = useCallback((_, v) => {
    setValues(v);
  }, []);

  const { input } = useField(useFollowsName);

  const hasError = useCallback(
    (value, { [useFollowsName]: useFollows }) => {
      if (useFollows ? false : !(value?.length > 0)) {
        return 'Must select at least one manga or use follows';
      }
    },
    [useFollowsName]
  );

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
    }}
    >
      <Autocomplete
        label={label}
        name={name}
        limitTags={3}
        options={data || noData}
        value={values}
        inputValue={query}
        onInputChange={onInputChange}
        onChange={onValueChange}
        filterOptions={showAll}
        groupBy={groupByKey}
        getOptionValue={getOptionValue}
        getOptionLabel={getOptionLabel}
        isOptionEqualToValue={optionEquals}
        fieldProps={{
          validate: hasError,
        }}
        disableCloseOnSelect
        multiple
        freeSolo
        disabled={typeof input.value === 'boolean' ? input.value : false}
        {...autocompleteProps}
      />
      OR
      <Checkboxes
        sx={{ ml: 2 }}
        name={useFollowsName}
        color='primary'
        data={{ label: 'Use follows' }}
      />
    </Box>
  );
};
MangaSelector.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  useFollowsName: PropTypes.string.isRequired,
};

export default MangaSelector;
