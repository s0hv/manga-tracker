import React, { FunctionComponent } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { SnackbarProvider } from 'notistack';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  expectErrorSnackbar,
  expectNoSnackbar,
  expectSuccessSnackbar,
  mockNotistackHooks,
  mockRequestJson,
  mockRequestWithBody,
  mockUTCDates,
  muiSelectValue,
  queryClient,
  restoreMocks,
  setupMockServer,
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

const server = setupMockServer();

const mangaId = 1;
const mangaServicesUrl = `/api/admin/manga/${mangaId}/services`;

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
    const mangaServicesMock = mockRequestJson(server, mangaServicesUrl, mangaServices);
    const servicesMock = mockRequestJson(server, '/api/services', services);

    act(() => {
      render(<Component />);
    });

    expectHeadersExist();

    await waitForRender();

    expect(servicesMock).toHaveBeenCalledOnce();
    expect(mangaServicesMock).toHaveBeenCalledOnce();

    const sorted = [...mangaServices].sort((a, b) => (a.serviceId > b.serviceId ? 1 : -1));

    screen.getAllByRole('row')
      .slice(1)
      .forEach((rowElem, idx) => {
        const row = within(rowElem);
        const mangaService = sorted[idx];
        const service = services.find(s => s.serviceId === mangaService.serviceId)!;

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
    server.use(
      http.get(mangaServicesUrl, () => new HttpResponse(null, { status: 500 })),
      http.get('/api/services', () => new HttpResponse(null, { status: 500 }))
    );

    const spies = silenceConsole();
    act(() => {
      render(<Component />);
    });

    expectHeadersExist();

    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
    restoreMocks(spies);

    expect(screen.getAllByRole('row')).toHaveLength(1);
  });
});

describe('MangaServiceTable should allow editing', () => {
  mockUTCDates();
  const length = 2;
  const mangaService = mangaServices[0];
  const updateUrl = `/api/admin/manga/${mangaId}/services/:serviceId`;

  beforeEach(async () => {
    await mockNotistackHooks();
    mockRequestJson(server, mangaServicesUrl, [mangaService]);
    mockRequestJson(server, '/api/services', services);
  });

  it('Shows nothing when no changes made', async () => {
    const updateMock = mockRequestWithBody(server, updateUrl, {});
    render(<Component />);

    await waitForRender(length);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit row/i }));
    await user.click(screen.getByRole('button', { name: /save row/i }));

    expectNoSnackbar();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('Shows success snackbar when edit is successful with new value', async () => {
    const updateMock = mockRequestWithBody(server, updateUrl, {});

    render(<Component />);
    await waitForRender(length);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit row/i }));
    await user.click(screen.getByRole('checkbox', { name: /^disabled$/i }));
    await user.click(screen.getByRole('button', { name: /save row/i }));

    await waitFor(() => expectSuccessSnackbar());

    expect(updateMock).toHaveBeenLastCalledWith({ mangaService: {
      disabled: !mangaService.disabled,
    }});
  });

  it('Shows error snackbar when edit is not successful', async () => {
    server.use(http.post(updateUrl, () => new HttpResponse(null, { status: 500 })));

    render(<Component />);
    await waitForRender(length);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit row/i }));
    await user.click(screen.getByRole('checkbox', { name: /^disabled$/i }));
    await user.click(screen.getByRole('button', { name: /save row/i }));

    await waitFor(() => expectErrorSnackbar());
  });
});

describe('MangaServiceTable should allow creating', () => {
  const mangaService = mangaServices[0];
  const newService = services[1];
  const createUrl = `/api/admin/manga/${mangaId}/services/${newService.serviceId}/create`;

  beforeEach(async () => {
    await mockNotistackHooks();
    mockRequestJson(server, mangaServicesUrl, [mangaService]);
    mockRequestJson(server, '/api/services', services);
  });

  const fillCreateForm = async (disabled: boolean) => {
    render(<Component />);
    await waitForRender(2);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /create manga service/i }));
    await muiSelectValue(user, screen, /^service/i, newService.name);
    await user.type(screen.getByRole('textbox', { name: /^title id/i }), 'new-title-id');
    if (disabled) {
      await user.click(screen.getByRole('checkbox', { name: /^disabled$/i }));
    }
    await user.click(screen.getByRole('button', { name: /^create row$/i }));
  };

  it.each([true, false])('Sends disabled=%s when creating a manga service', async disabled => {
    const createMock = mockRequestWithBody(server, createUrl, {});

    await fillCreateForm(disabled);

    await waitFor(() => expectSuccessSnackbar());

    expect(createMock).toHaveBeenCalledOnce();
    const body = createMock.mock.lastCall![0] as { mangaService: Record<string, unknown> };
    expect(body.mangaService).toMatchObject({ titleId: 'new-title-id' });
    expect(body.mangaService.disabled ?? false).toBe(disabled);
    expect(body.mangaService).not.toHaveProperty('serviceId');
  });

  it('Shows error snackbar when creation fails', async () => {
    mockRequestWithBody(server, createUrl, { error: 'Resource already exists' }, { status: 422 });

    await fillCreateForm(false);

    await waitFor(() => expectErrorSnackbar('Resource already exists'));
  });
});
