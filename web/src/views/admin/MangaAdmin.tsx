import React, { useCallback, useMemo, useState } from 'react';
import SubdirectoryArrowLeftIcon
  from '@mui/icons-material/SubdirectoryArrowLeft';
import {
  Box,
  Container,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  type ColumnDef,
  type Row,
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature, sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { useConfirm } from 'material-ui-confirm';
import { useSnackbar } from 'notistack';
import { SelectElement } from 'react-hook-form-mui';

import {
  createScheduledRunMutationOptions,
  deleteScheduledRunMutationOptions,
  getScheduledRunsKey,
  getScheduledRunsQueryOptions,
} from '#web/api/admin/manga';
import { getManga } from '#web/api/manga';
import { RouteLink } from '@/components/common/RouteLink';
import { MangaServiceTable } from '@/components/manga/MangaServiceTable';
import { MangaCover } from '@/components/MangaCover';
import {
  AddRowFormTemplate,
  MaterialTable,
} from '@/components/MaterialTable';
import {
  getDeleteColumnDef,
  rowDeletingPlugin,
} from '@/components/MaterialTable/plugins';
import type {
  DialogComponentProps,
} from '@/components/MaterialTable/TableToolbar';
import type { FullMangaData, ScheduledRun } from '@/types/api/manga';
import type { ServiceConfig } from '@/types/api/services';
import { noRows } from '@/webUtils/constants';

import MangaInfo from '../../components/EditableMangaInfo';
import MangaAliases from '../../components/MangaAliases';

type AddTableRowForm = {
  serviceId: string
};

const MangaTitle = styled(Typography)(({ theme }) => ({
  width: '75%',
  textAlign: 'left',
  paddingBottom: '10px',
  [theme.breakpoints.down('md')]: {
    width: '100%',
  },
}));

const DetailsContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  flexFlow: 'row',
  [theme.breakpoints.down('sm')]: {
    flexFlow: 'wrap',
    justifyContent: 'center',
  },
}));


const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowDeletingPlugin,
  sortFns: {
    text: sortFn_text,
  },
});
type Features = typeof features;

const columnHelper = createColumnHelper<Features, ScheduledRun>();

export type MangaAdminProps = {
  mangaData: FullMangaData
  serviceConfigs: Pick<ServiceConfig, 'scheduledRunsEnabled' | 'serviceId'>[]
};

function MangaAdmin(props: MangaAdminProps) {
  const {
    mangaData: {
      manga,
      services,
      aliases: aliasesProp,
    },
    serviceConfigs,
  } = props;

  // Constants
  const mangaId = manga.mangaId;

  // Hooks
  const { enqueueSnackbar } = useSnackbar();
  const confirm = useConfirm();

  const [aliases, setAliases] = useState(aliasesProp);
  const [mangaTitle, setMangaTitle] = useState(manga.title);

  const formatScheduledRuns = useCallback<(runs: ScheduledRun[]) => ScheduledRun[]>(runs => runs.map(run => {
    const found = services.find(s => s.serviceId === run.serviceId);
    if (!found) {
      return run;
    }
    return {
      ...run,
      name: found.name,
    };
  }), [services]);

  const onTitleChange = useCallback(() => {
    getManga(mangaId)
      .then(data => {
        setAliases(data.aliases);
        setMangaTitle(data.manga.title);
      });
  }, [mangaId]);

  const {
    isFetching: loading,
    data,
  } = useQuery({
    ...getScheduledRunsQueryOptions(mangaId),
    select: formatScheduledRuns,
  });

  const createScheduledRun = useMutation({
    ...createScheduledRunMutationOptions,
    onSuccess: (_, variables) => {
      enqueueSnackbar(
        `Successfully scheduled manga ${variables.mangaId} to be checked on service ${variables.serviceId}`,
        { variant: 'success' }
      );
    },
    onError: error => {
      enqueueSnackbar(error.message, { variant: 'error' });
    },
  });

  const deleteScheduledRun = useMutation(deleteScheduledRunMutationOptions);

  const scheduledUpdates = data ?? noRows;

  const onCreateRow = useCallback((form: AddTableRowForm) => {
    createScheduledRun.mutate({ mangaId, serviceId: form.serviceId });
  }, [createScheduledRun, mangaId]);

  const onRowDelete = useCallback((row: Row<Features, ScheduledRun>) => {
    const serviceId = row.original.serviceId;

    deleteScheduledRun.mutate(
      { mangaId, serviceId },
      {
        onSuccess: (_, variables, __, context) => {
          context.client.setQueryData<ScheduledRun[]>(
            getScheduledRunsKey(variables.mangaId),
            old => old?.filter(r => r.serviceId !== serviceId)
          );

          enqueueSnackbar(
            `Successfully deleted service ${row.original.name} from scheduled runs`,
            { variant: 'success' }
          );
        },

        onError: error => {
          enqueueSnackbar(error.message, { variant: 'error' });
        },
      }
    );
  }, [deleteScheduledRun, enqueueSnackbar, mangaId]);

  // Table layout
  const fields = useMemo(() => {
    const servicesWithRunsEnabled = new Set(
      serviceConfigs.filter(s => s.scheduledRunsEnabled).map(s => s.serviceId)
    );
    const options = services
      ?.filter(s => servicesWithRunsEnabled.has(s.serviceId))
      .map(s => ({ value: s.serviceId, label: s.name }));

    return [
      <SelectElement
        label='Service'
        name='serviceId'
        key='serviceId'
        aria-label='Service select'
        options={options}
        valueKey='value'
        required
        fullWidth
      />,
    ];
  }, [services, serviceConfigs]);

  // The component is memoized with useMemo. I don't see a problem
  // eslint-disable-next-line react/no-unstable-nested-components
  const CreateDialog = useMemo(() => ({ open, onClose }: DialogComponentProps) => (
    <AddRowFormTemplate
      fields={fields}
      onSuccess={onCreateRow}
      onClose={onClose}
      open={open}
      sx={{
        minWidth: '150px',
        pt: '0.5em',
        mt: 2,
      }}
    />
  ), [fields, onCreateRow]);

  const columns = useMemo((): ColumnDef<Features, ScheduledRun>[] => columnHelper.columns([
    columnHelper.accessor('name', {
      header: 'Service name',
      sortFn: 'text',
      cell: info => info.getValue(),
    }),

    columnHelper.accessor('serviceId', {
      header: 'Service id',
      sortFn: 'text',
    }),

    getDeleteColumnDef(),
  ]), []);

  const table = useTable({
    columns,
    features,
    data: scheduledUpdates,
    confirm,
    handleDeleteRowConfirmed: onRowDelete,
  });

  return (
    <Container maxWidth='lg' disableGutters>
      <Paper sx={{ p: '1em', minWidth: '400px' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <MangaTitle variant='h4'>{mangaTitle}</MangaTitle>
          <RouteLink to='/manga/$mangaId' params={{ mangaId: manga.mangaId.toString() }}>
            <Tooltip title='Go back' aria-label='go back to manga page'>
              <IconButton size='large'>
                <SubdirectoryArrowLeftIcon />
              </IconButton>
            </Tooltip>
          </RouteLink>
        </Box>

        <DetailsContainer>
          <a href={manga.mal || ''} target='_blank' rel='noreferrer noopener'>
            <MangaCover
              url={manga.cover}
              alt={manga.title}
            />
          </a>
          <Stack
            sx={{ ml: { sx: '0px', sm: 4 }, width: 'fit-content' }}
          >
            <MangaInfo mangaData={manga} />
            <MangaAliases
              aliases={aliases}
              mangaId={mangaId}
              onTitleUpdate={onTitleChange}
              enqueueSnackbar={enqueueSnackbar}
              confirm={confirm}
              allowEdits
            />
          </Stack>
        </DetailsContainer>

        <MangaServiceTable mangaId={mangaId} sx={{ mb: 4 }} />

        <MaterialTable
          table={table}
          rowCount={2}
          enableRowCreation
          CreateDialog={CreateDialog}
          title='Scheduled runs'
          loading={loading}
          toolbarProps={{ addButtonLabel: 'add scheduled run' }}
        />
      </Paper>
    </Container>
  );
}

export default MangaAdmin;
