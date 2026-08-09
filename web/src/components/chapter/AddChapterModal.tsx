import React, { useCallback, useMemo } from 'react';
import {
  type SxProps,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
} from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { type SubmitHandler, useForm } from 'react-hook-form';
import { SelectElement, TextFieldElement } from 'react-hook-form-mui';
import { DateTimePickerElement } from 'react-hook-form-mui/date-pickers';
import * as z from 'zod';

import { fixChapterFailedMutationOptions } from '#web/api/admin/chaptersFailed';
import { getServicesQueryOptions } from '#web/api/services';
import { DbChapter } from '@/common/schemas/chapter';
import { dbId } from '@/common/schemas/common';
import { SearchGroup } from '@/common/schemas/group';
import { ShortMangaInfo } from '@/components/chapter/ShortMangaInfo';
import { FormGroupSearch } from '@/components/inputs/FormGroupSearch';
import { FormMangaSearch } from '@/components/inputs/FormMangaSearch';
import type { NullableExcept } from '@/types/utility';

export const DbChapterForm = DbChapter
  .omit({ chapterId: true, mangaId: true, groupId: true })
  .extend({
    // AutocompleteElement does not play well without an object with both
    // the ID and a label
    manga: z.object({
      mangaId: dbId,
      title: z.string(),
    }),
    group: SearchGroup.extend({
      // null for initial group and new groups
      groupId: dbId.nullable(),
    }),
  });
export type DbChapterForm = z.infer<typeof DbChapterForm>;

export type AddChapterInitialValues = NullableExcept<DbChapterForm, 'serviceId' | 'chapterIdentifier'>;

export type AddChapterModalProps = {
  initialValues: AddChapterInitialValues
  isOpen: boolean
  onClose: () => void
};

const fitContentInput = {
  '& input': {
    fieldSizing: 'content',
  },
} as const satisfies SxProps;

const resolver = zodResolver<
  AddChapterInitialValues,
  unknown,
  DbChapterForm
>(DbChapterForm);

export const AddChapterModal = ({
  initialValues,
  isOpen,
  onClose,
}: AddChapterModalProps) => {
  const {
    data: services,
  } = useQuery(getServicesQueryOptions);

  const fixChapter = useMutation(fixChapterFailedMutationOptions);
  const { enqueueSnackbar } = useSnackbar();

  const {
    handleSubmit,
    control,
    setValue,
  } = useForm<AddChapterInitialValues, unknown, DbChapterForm>({
    resolver,
    defaultValues: initialValues,
  });

  const onSubmit = useCallback<SubmitHandler<DbChapterForm>>(async values => {
    const {
      manga,
      ...rest
    } = values;

    await fixChapter.mutateAsync({
      ...rest,
      // We need to re-add these because they are disabled and thus not
      // included in the form submission
      chapterIdentifier: initialValues.chapterIdentifier,
      serviceId: initialValues.serviceId,
      mangaId: manga.mangaId,
    })
      .catch(err => {
        // TODO better error message handling
        enqueueSnackbar(
          `Failed to fix failed chapter. ${err}`,
          { variant: 'error' }
        );
        throw err;
      });

    enqueueSnackbar(
      'Chapter added successfully',
      { variant: 'success' }
    );

    onClose();
  }, [fixChapter, onClose, enqueueSnackbar, initialValues.serviceId, initialValues.chapterIdentifier]);

  const servicesOption = useMemo(() => [{
    label: services?.[initialValues.serviceId].name ?? '',
    value: initialValues.serviceId,
  }], [services, initialValues.serviceId]);

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      aria-label='Create chapter form'
      maxWidth='md'
      fullWidth
    >
      <DialogTitle>Create chapter</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Grid container spacing={2}>
            <SelectElement
              name='serviceId'
              label='Service'
              valueKey='value'
              options={servicesOption}
              control={control}
              disabled
              sx={fitContentInput}
            />
            <TextFieldElement
              name='chapterIdentifier'
              label='Chapter Identifier'
              control={control}
              required
              disabled
              sx={fitContentInput}
            />
          </Grid>

          <TextFieldElement
            name='title'
            label='Chapter title'
            control={control}
            required
            fullWidth
          />

          <Grid container spacing={1}>
            <TextFieldElement
              name='chapterNumber'
              label='Chapter number'
              control={control}
              type='number'
              required
            />

            <TextFieldElement
              name='chapterDecimal'
              label='Chapter decimal'
              control={control}
              type='number'
            />

            <DateTimePickerElement
              control={control}
              name='releaseDate'
              label='Release date'
              required
              disableFuture
              sx={{ ml: 2 }}
            />
          </Grid>

          <FormGroupSearch
            control={control}
            name='group'
            label='Group'
            required
            setFieldValue={setValue}
            sx={{
              maxWidth: { md: '600px' },
            }}
          />

          <FormMangaSearch
            control={control}
            name='manga'
            label='Manga'
            serviceId={initialValues.serviceId}
            setFieldValue={setValue}
            required
          />

          <ShortMangaInfo
            control={control}
            serviceId={initialValues.serviceId}
          />

        </Stack>
      </DialogContent>

      <DialogActions>
        <Button
          type='submit'
          variant='outlined'
          color='primary'
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          variant='outlined'
          color='primary'
          onClick={handleSubmit(onSubmit)}
        >
          Create row
        </Button>
      </DialogActions>
    </Dialog>
  );
};
