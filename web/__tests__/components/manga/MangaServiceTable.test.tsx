import React, { FunctionComponent } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { SnackbarProvider } from 'notistack';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  expectErrorSnackbar,
  expectNoSnackbar,
  expectRequestCalledWithBody,
  expectSuccessSnackbar,
  mockNotistackHooks,
  mockUTCDates,
  queryClient,
  restoreMocks,
  silenceConsole,
  withRoot,
} from '../../utils';
import { MangaServiceTable } from '@/components/manga/MangaServiceTable';
import { MangaService } from '@/types/api/manga';
import { ServiceForApi } from '@/types/api/services';
import { defaultDateFormat } from '@/webUtils/utilities';

import {
  generateNSchemas,
  MangaService as MangaServiceSchema,
  Service,
  setupFaker,
} from '../../schemas';

const mangaId = 1;

const Root: FunctionComponent<any> = ({ children }: React.PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>
    <SnackbarProvider>
      {children}
    </SnackbarProvider>
  </QueryClientProvider>
);

const Component: FunctionComponent = () => withRoot(<Root><MangaServiceTable mangaId={mangaId} /></Root>);

setupFaker();
const mangaServices = generateNSchemas<MangaService>(MangaServiceSchema, 5);
const services = generateNSchemas<ServiceForApi>(Service, 5);
mangaServices.forEach((ms, idx) => {
  ms.mangaId = mangaId;
  ms.serviceId = services[idx].serviceId;
});


const waitForRender = (length = mangaServices.length + 1) => waitFor(() => {
  expect(screen.getAllByRole('row')).toHaveLength(length);
});

beforeEach(() => {
  queryClient.clear();
  fetchMock.reset();
});


describe('MangaServiceTable should render correctly', () => {
  mockUTCDates();

  const expectHeadersExist = () => {
    expect(screen.getByRole('columnheader', { name: /^Service$/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^Disabled$/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^Title id$/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^Last check$/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^Next update$/i })).toBeInTheDocument();
  };

  it('Should render correctly with data', async () => {
    fetchMock.get(`/api/admin/manga/${mangaId}/services`, mangaServices);
    fetchMock.get('/api/services', services);

    await act(async () => {
      render(<Component />);
    });

    expectHeadersExist();

    expect(fetchMock.calls(`/api/services`)).toHaveLength(1);
    expect(fetchMock.calls(`/api/admin/manga/${mangaId}/services`)).toHaveLength(1);

    await waitForRender();

    const sorted = [...mangaServices].sort((a, b) => (a.serviceId > b.serviceId ? 1 : -1));

    screen.getAllByRole('row')
      .slice(1)
      .forEach((rowElem, idx) => {
        const row = within(rowElem);
        const mangaService = sorted[idx];
        const service = services.filter(s => s.serviceId === mangaService.serviceId)[0];

        expect(row.getByRole('cell', { name: service.name })).toBeInTheDocument();

        const disabled = row.getByRole('checkbox');
        expect(disabled).toBeInTheDocument();
        expect(disabled).toBeDisabled();
        if (mangaService.disabled) {
          // eslint-disable-next-line vitest/no-conditional-expect
          expect(disabled).toBeChecked();
        }

        expect(row.getByRole('cell', { name: mangaService.titleId })).toBeInTheDocument();

        expect(row.getAllByRole('cell', {
          name: defaultDateFormat(mangaService.lastCheck ? new Date(mangaService.lastCheck) : null),
        })[0]).toBeInTheDocument();

        const found = row.getAllByRole('cell', {
          name: defaultDateFormat(mangaService.nextUpdate ? new Date(mangaService.nextUpdate) : null),
        });
        expect(found[found.length - 1]).toBeInTheDocument();
      });
  });

  it('Should render correctly with failed request', async () => {
    fetchMock.get(`/api/admin/manga/${mangaId}/services`, 500);
    fetchMock.get('/api/services', 500);

    const spies = silenceConsole();
    await act(async () => {
      render(<Component />);
    });
    restoreMocks(spies);

    expectHeadersExist();

    expect(screen.getAllByRole('row')).toHaveLength(1);
  });
});

describe('MangaServiceTable should allow editing', () => {
  mockUTCDates();
  const length = 2;
  const mangaService = mangaServices[0];

  beforeEach(async () => {
    await mockNotistackHooks();
    fetchMock.reset();
    fetchMock.get(`/api/admin/manga/${mangaId}/services`, [mangaService]);
    fetchMock.get('/api/services', services);
  });

  it('Shows nothing when no changes made', async () => {
    render(<Component />);

    await waitForRender(length);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit row/i }));
    await user.click(screen.getByRole('button', { name: /save row/i }));

    expectNoSnackbar();
  });

  it('Shows success snackbar when edit is successful with new value', async () => {
    fetchMock.post(`express:/api/admin/manga/${mangaId}/services/:serviceId`, 200);

    render(<Component />);
    await waitForRender(length);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit row/i }));
    await user.click(screen.getByRole('checkbox', { name: /^disabled$/i }));
    await user.click(screen.getByRole('button', { name: /save row/i }));

    expectSuccessSnackbar();

    const lastCall = fetchMock.lastCall(undefined, { method: 'POST' });

    expectRequestCalledWithBody(lastCall, { mangaService: {
      disabled: !mangaService.disabled,
    }});
  });

  it('Shows error snackbar when edit is not successful', async () => {
    fetchMock.post(`express:/api/admin/manga/${mangaId}/services/:serviceId`, 500);

    render(<Component />);
    await waitForRender(length);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit row/i }));
    await user.click(screen.getByRole('checkbox', { name: /^disabled$/i }));
    await user.click(screen.getByRole('button', { name: /save row/i }));

    expectErrorSnackbar();
  });
});
