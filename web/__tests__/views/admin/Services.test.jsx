import React from 'react';
import { render, screen, within } from '@testing-library/react';

import { mockNotistackHooks, mockUTCDates } from '../../utils';
import Services from '../../../src/views/admin/Services';


describe('Services page should render correctly', () => {
  mockUTCDates();
  mockNotistackHooks();
  const services = [
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
