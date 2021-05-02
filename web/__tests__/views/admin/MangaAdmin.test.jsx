import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import fetchMock from 'fetch-mock';
import React from 'react';

import {
  enqueueSnackbarMock,
  expectErrorSnackbar,
  expectSuccessSnackbar,
  mockNotistackHooks,
  mockUTCDates,
  muiSelectValue,
} from '../../utils';
import MangaAdmin from '../../../src/views/admin/MangaAdmin';
import { fullManga } from '../../constants';


beforeEach(() => mockNotistackHooks());

const mangaId = fullManga.manga.manga_id;

describe('Manga admin page should render correctly', () => {
  mockUTCDates();
  fetchMock.get('*', []);

  it('should render correctly without data', async () => {
    let baseElement;
    await act(async () => {
      ({ baseElement } = render(<MangaAdmin mangaData={{ manga: {}}} />));
    });

    expect(baseElement).toMatchSnapshot();
  });

  it('should render correctly with data', async () => {
    let baseElement;
    await act(async () => {
      ({ baseElement } = render(<MangaAdmin mangaData={fullManga} />));
    });

    expect(baseElement).toMatchSnapshot();
  });
});

describe('Manga admin page should handle data fetching correctly', () => {
  const mockServices = fullManga.services.map(s => ({
    service_id: s.service_id,
    manga_id: mangaId,
  }));
  const getMock = jest.fn().mockReturnValue({ data: mockServices });

  beforeEach(() => {
    fetchMock.reset();
    fetchMock.get(`/api/admin/manga/${mangaId}/scheduledRuns`, getMock);
  });

  const renderPage = async () => {
    await act(async () => {
      render(<MangaAdmin mangaData={fullManga} />);
    });
    expect(getMock).toHaveBeenCalledTimes(1);
  };

  const submitForm = async () => {
    await act(async () => {
      userEvent.click(screen.getByRole('button', { name: 'Create row' }));
    });
  };

  const deleteRow = async () => {
    await act(async () => {
      userEvent.click(screen.getByRole('button', { name: 'Confirm delete row' }));
    });
  };

  it('Should fetch services on render', async () => {
    await renderPage();

    fullManga.services.forEach(s => {
      expect(screen.getByText(s.name)).toBeTruthy();
    });
  });

  it('Should call the correct endpoint on adding new run', async () => {
    const serviceId = fullManga.services[0].service_id;
    const serviceName = fullManga.services[0].name;
    const postMock = jest.fn().mockReturnValue({ inserted: { service_id: serviceId, name: serviceName }});
    const partialGetMock = jest.fn().mockReturnValue({ data: mockServices.slice(1, 2) });

    fetchMock.post(`/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`, postMock);
    fetchMock.get(`/api/admin/manga/${mangaId}/scheduledRuns`, partialGetMock, { overwriteRoutes: true });

    await act(async () => {
      render(<MangaAdmin mangaData={fullManga} />);
    });
    expect(partialGetMock).toHaveBeenCalledTimes(1);

    expect(screen.queryByText(serviceName)).toBeNull();

    userEvent.click(screen.getByLabelText('Add item'));

    const form = within(screen.getByRole('presentation', { name: 'Create item form' }));
    muiSelectValue(form, 'Service select', serviceName);

    await submitForm();

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(serviceName)).toBeTruthy();
    expectSuccessSnackbar();
  });

  it('Should remove row on delete', async () => {
    const serviceId = fullManga.services[0].service_id;
    const serviceName = fullManga.services[0].name;
    const deleteMock = jest.fn().mockReturnValue({});

    fetchMock.delete(`/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`, deleteMock);

    await renderPage();

    const rowElement = screen.getByText(serviceName).closest('tr');
    const row = within(rowElement);

    userEvent.click(row.getByRole('button', { name: 'Delete row' }));

    await deleteRow();

    expect(deleteMock).toHaveBeenCalledTimes(1);

    expect(screen.queryByText(serviceName)).toBeNull();
    expectSuccessSnackbar();
  });

  it('Should show error snackbar on error', async () => {
    const serviceId = fullManga.services[0].service_id;
    const serviceName = fullManga.services[0].name;

    fetchMock.delete(`/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`, 500);
    fetchMock.post(`/api/admin/manga/${mangaId}/scheduledRun/${serviceId}`, 500);

    await renderPage();

    const rowElement = screen.getByText(serviceName).closest('tr');
    const row = within(rowElement);

    userEvent.click(row.getByRole('button', { name: 'Delete row' }));

    await deleteRow();

    // Should not delete on error
    expect(screen.queryByText(serviceName)).toBeTruthy();
    expect(enqueueSnackbarMock).toHaveBeenCalledTimes(1);
    expectErrorSnackbar();

    userEvent.click(screen.getByLabelText('Add item'));

    const form = within(screen.getByRole('presentation', { name: 'Create item form' }));
    muiSelectValue(form, 'Service select', serviceName);

    await submitForm();
    expect(enqueueSnackbarMock).toHaveBeenCalledTimes(2);
    expectErrorSnackbar();
  });
});
