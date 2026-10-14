import { useEffect, useMemo } from 'react';
import { Box, formLabelClasses } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { sortBy } from 'es-toolkit';
import { useForm } from 'react-hook-form';
import { CheckboxButtonGroup } from 'react-hook-form-mui';

import { servicesQueryOptions } from '#web/api/services';
import { MangaStatus } from '@/common/mangaStatus';
import { noRows } from '@/webUtils/constants';
import { statusToString } from '@/webUtils/utilities';

const STATUS_OPTIONS: { label: string; value: number }[] = Object.values(MangaStatus)
  .map(key => ({ label: statusToString(key), value: key }));

const formDefaultValues: FiltersForm = {
  serviceIds: [],
  status: [],
};

export interface FiltersForm {
  serviceIds: number[];
  status: MangaStatus[];
}

export interface MangaSearchFiltersProps {
  serviceIds: number[] | undefined;
  onSubmit: (data: FiltersForm) => void;
}

export const MangaSearchFilters = ({
  serviceIds,
  onSubmit,
}: MangaSearchFiltersProps) => {
  const { data: serviceOptions } = useQuery({
    ...servicesQueryOptions,
    select: data => sortBy(
      data.map(service => ({ label: service.name, value: service.serviceId })),
      ['value']
    ),
  });

  const serviceOptionsFiltered = useMemo(() => {
    if (!serviceOptions || !serviceIds) return noRows;

    return serviceOptions?.filter(option => serviceIds.includes(option.value));
  }, [serviceIds, serviceOptions]);

  const { control, subscribe, handleSubmit } = useForm<FiltersForm>({
    defaultValues: formDefaultValues,
  });

  // Trigger form submit on form changes so filter updates get applied immediately
  useEffect(() => {
    const submit = handleSubmit(onSubmit);
    return subscribe({
      formState: { values: true },
      callback: () => { void submit() },
    });
  }, [subscribe, handleSubmit, onSubmit]);

  return (
    <Box sx={{
      minWidth: '170px',
      maxHeight: 'fit-content',
      display: 'flex',
      flexDirection: {
        md: 'column',
      },
      height: {
        // 64px top bar + 32px container padding
        md: 'calc(100vh - 96px)',
      },
      gap: 3,
      top: 10,
      position: {
        xs: 'relative',
        md: 'sticky',
      },
      flexShrink: 0,
      // && increases specificity
      [`&& .${formLabelClasses.focused}`]: {
        color: 'text.secondary',
      },
    }}
    >
      <CheckboxButtonGroup
        control={control}
        options={serviceOptionsFiltered}
        valueKey='value'
        name='serviceIds'
        label='Service'
      />

      <CheckboxButtonGroup
        control={control}
        options={STATUS_OPTIONS}
        valueKey='value'
        name='status'
        label='Status'
      />
    </Box>
  );
};
