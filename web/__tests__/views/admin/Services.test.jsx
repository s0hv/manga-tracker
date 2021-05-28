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
