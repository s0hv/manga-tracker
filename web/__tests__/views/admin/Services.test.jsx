import React from 'react';
import renderer from 'react-test-renderer';

import { mockNotistackHooks, mockUTCDates } from '../../utils';
import Services from '../../../src/views/admin/Services';


describe('Services page should render correctly', () => {
  mockUTCDates();
  mockNotistackHooks();
  const services = [
    {
      id: 2,
      service_name: 'MangaDex',
      disabled: false,
      url: 'https://mangadex.org',
      last_check: '2020-07-15T16:35:44.272Z',
      next_update: '2020-07-15T17:05:44.272Z',
    },
    {
      id: 5,
      service_name: 'ComiXology',
      disabled: false,
      url: 'https://www.comixology.com',
      last_check: '2020-07-15T15:51:28.846Z',
      next_update: null,
    },
    {
      id: 4,
      service_name: 'Kodansha Comics',
      disabled: true,
      url: 'https://kodanshacomics.com',
      last_check: null,
      next_update: '2020-07-15T17:46:42.852Z',
    },
    {
      id: 3,
      service_name: "Jaimini's Box",
      disabled: false,
      url: 'https://jaiminisbox.com',
      last_check: '2020-07-15T15:51:29.137Z',
      next_update: '2020-07-15T16:51:29.137Z',
    },
    {
      id: 1,
      service_name: 'MANGA Plus',
      disabled: false,
      url: 'https://mangaplus.shueisha.co.jp',
      last_check: '2020-07-15T15:51:17.885Z',
      next_update: null,
    },
  ];

  it('should render correctly without services', () => {
    const tree = renderer
      .create(<Services />)
      .toJSON();

    expect(tree).toMatchSnapshot();
  });

  it('should render correctly with services', () => {
    const tree = renderer
      .create(<Services services={services} />)
      .toJSON();

    expect(tree).toMatchSnapshot();
  });
});
