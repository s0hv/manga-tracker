import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import fetchMock from 'fetch-mock';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import {
  enqueueSnackbarMock,
  expectErrorSnackbar,
  expectSuccessSnackbar,
  mockNotistackHooks,
  mockUTCDates,
  muiSelectValue,
  withUser,
  adminUser,
  queryClient,
} from '../../utils';
import MangaAdmin from '../../../src/views/admin/MangaAdmin';
import { fullManga } from '../../constants';


beforeEach(() => {
  mockNotistackHooks();
  queryClient.clear();
});

const mangaId = fullManga.manga.mangaId;

describe('Manga admin page should render correctly', () => {
  mockUTCDates();
  fetchMock.get('*', []);

  it('should render correctly without data', async () => {
    await act(async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MangaAdmin mangaData={{ manga: {}}} serviceConfigs={[]} />
        </QueryClientProvider>
      );
    });

    expect(screen.getByRole('link', { name: 'go back to manga page' })).toBeInTheDocument();

    // Aliases
    expect(screen.queryByText(/alternative titles/i)).not.toBeInTheDocument();

    // Manga info
    expect(screen.getByText(/latest release/i)).toBeInTheDocument();

    // Check that scheduled runs table is rendered
    expect(screen.getByRole('table', { name: /scheduled runs/i })).toBeInTheDocument();
  });

  it('should render correctly with data', async () => {
    // Does not test scheduled runs. They are tested separately
    await act(async () => {
      render(
        await withUser(
          adminUser,
          <QueryClientProvider client={queryClient}>
            <MangaAdmin mangaData={fullManga} serviceConfigs={[]} />
          </QueryClientProvider>
        )
      );
    });

    expect(screen.getByRole('link', { name: 'go back to manga page' })).toBeInTheDocument();

    // Aliases
    expect(screen.getByText(/alternative titles/i)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/set alias as main title/i)).not.toHaveLength(0);

    // Manga info
    expect(screen.getByText(/latest release/i)).toBeInTheDocument();

    // Check that scheduled runs table is rendered
    expect(screen.getByRole('table', { name: /scheduled runs/i })).toBeInTheDocument();
  });

  it('should filter out services from add scheduled run menu', async () => {
    await act(async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MangaAdmin mangaData={fullManga} serviceConfigs={[]} />
        </QueryClientProvider>
      );
    });

    const user = userEvent.setup();
    await user.click(screen.getByLabelText('add scheduled run'));
    const form = within(screen.getByRole('presentation', { name: 'Create item form' }));
    expect(form.queryAllByRole('option')).toHaveLength(0);
  });
});

describe('Manga admin page should handle data fetching correctly', () => {
  const mockServices = fullManga.services.map(s => ({
    serviceId: s.serviceId,
    mangaId: mangaId,
  }));
  const getMock = jest.fn().mockReturnValue({ data: mockServices });

  beforeEach(() => {
    fetchMock.reset();
    fetchMock.get(`/api/admin/manga/${mangaId}/scheduledRuns`, getMock);
  });

  const renderPage = async (expectGetMock = true) => {
    const serviceConfigs = [
      {
        serviceId: fullManga.services[0].serviceId,
        scheduledRunsEnabled: true,
      },
    ];

    await act(async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MangaAdmin mangaData={fullManga} serviceConfigs={serviceConfigs} />
        </QueryClientProvider>
      );
    });

    if (expectGetMock) {
      expect(getMock).toHaveBeenCalledTimes(1);
    }
  };

  const submitForm = async (user) => {
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Create row' }));
    });
  };

  const deleteRow = async (user) => {
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Confirm delete row' }));
    });
  };

  it('Should fetch services on render', async () => {
    await renderPage();

    fullManga.services.forEach(s => {
      expect(screen.getByText(s.name)).toBeTruthy();
    });
  });

  it('Should call the correct endpoint on adding new run', async () => {
    const serviceId = fullManga.services[0].serviceId;
    const serviceName = fullManga.services[0].name;
    const postMock = jest.fn().mockReturnValue({ inserted: { serviceId: serviceId, name: serviceName }});
    const partialGetMock = jest.fn().mockReturnValue({ data: mockServices.slice(1, 2) });

    fetchMock.post(`/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`, postMock);
    fetchMock.get(`/api/admin/manga/${mangaId}/scheduledRuns`, partialGetMock, { overwriteRoutes: true });

    await renderPage(false);

    expect(partialGetMock).toHaveBeenCalledTimes(1);

    expect(screen.queryByText(serviceName)).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByLabelText('add scheduled run'));

    const form = within(screen.getByRole('presentation', { name: 'Create item form' }));
    await muiSelectValue(user, form, 'Service select', serviceName);

    await submitForm(user);

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(serviceName)).toBeTruthy();
    expectSuccessSnackbar();
  });

  it('Should remove row on delete', async () => {
    const serviceId = fullManga.services[0].serviceId;
    const serviceName = fullManga.services[0].name;
    const deleteMock = jest.fn().mockReturnValue({});

    fetchMock.delete(`/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`, deleteMock);

    await renderPage();

    const rowElement = screen.getByText(serviceName).closest('tr');
    const row = within(rowElement);

    const user = userEvent.setup();
    await user.click(row.getByRole('button', { name: 'Delete row' }));

    await deleteRow(user);

    expect(deleteMock).toHaveBeenCalledTimes(1);

    expect(screen.queryByText(serviceName)).toBeNull();
    expectSuccessSnackbar();
  });

  it('Should show error snackbar on error', async () => {
    const serviceId = fullManga.services[0].serviceId;
    const serviceName = fullManga.services[0].name;

    fetchMock.delete(`/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`, 500);
    fetchMock.post(`/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`, 500);

    await renderPage();

    const rowElement = screen.getByText(serviceName).closest('tr');
    const row = within(rowElement);

    const user = userEvent.setup();
    await user.click(row.getByRole('button', { name: 'Delete row' }));

    await deleteRow(user);

    // Should not delete on error
    expect(screen.queryByText(serviceName)).toBeTruthy();
    expect(enqueueSnackbarMock).toHaveBeenCalledTimes(1);
    expectErrorSnackbar();

    await user.click(screen.getByLabelText('add scheduled run'));

    const form = within(screen.getByRole('presentation', { name: 'Create item form' }));
    await muiSelectValue(user, form, 'Service select', serviceName);

    await submitForm(user);
    expect(enqueueSnackbarMock).toHaveBeenCalledTimes(2);
    expectErrorSnackbar();
  });
});
