import { Autocomplete, Checkboxes } from 'mui-rff';
import { useQuery } from '@tanstack/react-query';
import {
  type FC,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Box } from '@mui/material';
import { useField } from 'react-final-form';
import type { AutocompleteProps } from 'mui-rff/src/Autocomplete';
import type { FieldValidator } from 'final-form';
import { quickSearch } from '../../api/manga';
import type { NotificationFollow } from '@/types/api/notifications';
import {
  getOptionLabel,
  groupByKey,
  noData,
  optionEquals,
  showAll,
} from '@/components/notifications/utilities';

type AutocompleteType = AutocompleteProps<NotificationFollow, true, false, false>;
export type MangaSelectorProps = {
  name: string,
  label: string,
  useFollowsName: string,
  disabled?: boolean,
  overrideName?: string,
} & Omit<AutocompleteType,
  | 'name'
  | 'label'
  | 'options'
  | 'disabled'
>


const MangaSelector: FC<MangaSelectorProps> = ({
  name,
  label,
  useFollowsName,
  disabled,
  overrideName = 'overrideId',
  ...autocompleteProps
}) => {
  const [query, setQuery] = useState('');
  const { input: mangaInput } = useField(name);
  const { input: overrideInput } = useField(overrideName);
  const [override, setOverride] = useState(overrideInput.value);
  const [values, setValues] = useState(mangaInput.value || []);
  useEffect(() => {
    if (override !== overrideInput.value) {
      setOverride(overrideInput.value);
      setValues(mangaInput.value || []);
    }
  }, [mangaInput.value, overrideInput.value, override]);

  const doSearch = useCallback(async ({ queryKey }: { queryKey: string[]}): Promise<NotificationFollow[]> => {
    const searchQuery = queryKey[1]?.trim();
    if (searchQuery?.length < 2) return [];

    return quickSearch(searchQuery, true)
      .then(rows => {
        if (!rows) return [];
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
              serviceId: Number(serviceId),
              serviceName,
            })),
        ], [] as NotificationFollow[]);
      });
  }, []);

  const { data } = useQuery({
    queryKey: ['search-notif', query],
    queryFn: doSearch,
  });

  const onInputChange = useCallback((e: SyntheticEvent, value: string | null) => {
    if (typeof value === 'string') {
      setQuery(value);
    }
  }, []);

  const onValueChange = useCallback((_: any, v: NotificationFollow[]) => {
    setValues(v);
    setQuery(query);
  }, [query]);

  const { input } = useField(useFollowsName);

  const hasError: FieldValidator<NotificationFollow[] | null> = useCallback(
    (value: NotificationFollow[] | null, allValues?: any) => {
      const useFollows = allValues ? allValues![useFollowsName] : false;
      if (useFollows ? false : !((value?.length ?? 0) > 0)) {
        return 'Must select at least one manga or use follows';
      }
    },
    [useFollowsName]
  );

  const autocompleteDisabled = disabled || (typeof input.value === 'boolean' ? input.value : false);

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
        getOptionLabel={getOptionLabel}
        isOptionEqualToValue={optionEquals}
        fieldProps={{
          validate: hasError,
        }}
        disableCloseOnSelect
        clearOnBlur={false}
        multiple
        disabled={autocompleteDisabled}
        {...autocompleteProps}
      />
      OR
      <Checkboxes
        sx={{ ml: 2 }}
        name={useFollowsName}
        color='primary'
        data={{ label: 'Use follows', value: undefined }}
        disabled={disabled}
      />
    </Box>
  );
};

export default MangaSelector;
