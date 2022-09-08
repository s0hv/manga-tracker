import React from 'react';
import { act, render, screen, within } from '@testing-library/react';

import fetchMock from 'fetch-mock';
import userEvent from '@testing-library/user-event';
import {
  expectErrorSnackbar,
  expectNoSnackbar,
  expectRequestCalledWithBody,
  expectSuccessSnackbar,
  getRowByColumnValue,
  mockNotistackHooks,
  mockUTCDates,
  withRoot,
} from '../../utils';
import Services from '../../../src/views/admin/Services';
import { ServiceForAdminSerialized } from '@/types/api/services';

const services: ServiceForAdminSerialized[] = [
  {
    id: 2,
    serviceName: 'MangaDex',
    disabled: false,
    url: 'https://mangadex.org',
    lastCheck: '2020-07-15T16:35:44.272Z',
    nextUpdate: '2020-07-15T17:05:44.272Z',
  },
  {
    id: 5,
    serviceName: 'ComiXology',
    disabled: false,
    url: 'https://www.comixology.com',
    lastCheck: '2020-07-15T15:51:28.846Z',
    nextUpdate: null,
  },
  {
    id: 4,
    serviceName: 'Kodansha Comics',
    disabled: true,
    url: 'https://kodanshacomics.com',
    lastCheck: null,
    nextUpdate: '2020-07-15T17:46:42.852Z',
  },
  {
    id: 3,
    serviceName: "Jaimini's Box",
    disabled: false,
    url: 'https://jaiminisbox.com',
    lastCheck: '2020-07-15T15:51:29.137Z',
    nextUpdate: '2020-07-15T16:51:29.137Z',
  },
  {
    id: 1,
    serviceName: 'MANGA Plus',
    disabled: false,
    url: 'https://mangaplus.shueisha.co.jp',
    lastCheck: '2020-07-15T15:51:17.885Z',
    nextUpdate: null,
  },
];

describe('Services page should render correctly', () => {
  mockUTCDates();
  mockNotistackHooks();

  const expectHeadersExist = () => {
    const headerRow = within(screen.getAllByRole('row')[0]);

    expect(headerRow.getByText('Id')).toBeInTheDocument();
    expect(headerRow.getByText('Name')).toBeInTheDocument();
    expect(headerRow.getByText('Last checked')).toBeInTheDocument();
    expect(headerRow.getByText('Next update')).toBeInTheDocument();
    expect(headerRow.getByText('Disabled')).toBeInTheDocument();
  };

  it('should render correctly without services', () => {
    render(<Services />);

    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(1);

    expectHeadersExist();
  });

  it('should render correctly with services', () => {
    render(<Services services={services} />);

    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(services.length + 1);

    expectHeadersExist();
  });
});

describe('Services page should allow editing', () => {
  const service = { ...services[0] };

  beforeEach(() => {
    mockNotistackHooks();
    fetchMock.reset();
  });

  const getRow = () => {
    const rowElem = getRowByColumnValue(
      screen.getByRole('table'),
      'Id',
      (elem: HTMLTableCellElement) => elem.textContent === service.id.toString()
    );

    expect(rowElem).toBeInTheDocument();
    return within(rowElem);
  };

  it('Shows nothing when no changes made', async () => {
    render(withRoot(<Services services={services} />));

    const row = getRow();

    const user = userEvent.setup();
    await user.click(row.getByRole('button', { name: /edit row/i }));
    await act(async () => {
      await user.click(row.getByRole('button', { name: /save row/i }));
    });

    expectNoSnackbar();
  });

  it('Shows success snackbar when edit is successful with new value', async () => {
    fetchMock.post('express:/api/admin/editService/:serviceId', 200);

    render(withRoot(<Services services={services} />));

    const row = getRow();

    const user = userEvent.setup();
    await user.click(row.getByRole('button', { name: /edit row/i }));
    await user.click(screen.getByRole('checkbox', { name: /^disabled$/i }));
    await act(async () => {
      await user.click(row.getByRole('button', { name: /save row/i }));
    });

    expectSuccessSnackbar();

    const lastCall = fetchMock.lastCall(undefined, { method: 'POST' });

    expectRequestCalledWithBody(lastCall, { service: {
      disabled: !service.disabled,
    },
    serviceWhole: {}});
  });

  it('Shows error snackbar when edit is not successful', async () => {
    fetchMock.post('express:/api/admin/editService/:serviceId', 500);

    render(withRoot(<Services services={services} />));

    const row = getRow();

    const user = userEvent.setup();
    await user.click(row.getByRole('button', { name: /edit row/i }));
    await user.click(screen.getByRole('checkbox', { name: /^disabled$/i }));
    await act(async () => {
      await user.click(row.getByRole('button', { name: /save row/i }));
    });

    expectErrorSnackbar();
  });
});
