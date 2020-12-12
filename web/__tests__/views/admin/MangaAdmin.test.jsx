import React from 'react';
import { render, screen, act, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import fetchMock from 'fetch-mock';

import {
  expectSuccessSnackbar,
  mockNotistackHooks,
  mockUTCDates,
  enqueueSnackbarMock, expectErrorSnackbar, muiSelectValue,
} from '../../utils';
import MangaAdmin from '../../../src/views/admin/MangaAdmin';

const manga = { manga_id: 1,
  title: 'Dr. STONE',
  release_interval: {
    days: 7,
  },
  latest_release: '2020-07-05T16:00:00.000Z',
  estimated_release: '2020-07-12T16:00:00.000Z',
  latest_chapter: 157,
  services: [
    {
      title_id: '100010',
      service_id: 1,
      name: 'MANGA Plus',
      url_format: 'https://mangaplus.shueisha.co.jp/viewer/{}',
      url: 'https://mangaplus.shueisha.co.jp/titles/{}',
    },
    {
      title_id: '20882',
      service_id: 2,
      name: 'MangaDex',
      url_format: 'https://mangadex.org/chapter/{}',
      url: 'https://mangadex.org/title/{}',
    },
  ],
  cover: 'https://mangadex.org/images/manga/20882.jpg?1585634146',
  status: 0,
  artist: 'Boichi',
  author: 'Inagaki Riichiro',
  last_updated: '2020-06-28T08:15:55.170Z',
  bw: 'https://bookwalker.jp/series/114645',
  mu: 'https://www.mangaupdates.com/series.html?id=139601',
  mal: 'https://myanimelist.net/manga/103897',
  amz: 'https://www.amazon.co.jp/gp/product/B075F8JBQ1',
  ebj: 'https://www.ebookjapan.jp/ebj/413780/',
  engtl: 'https://www.viz.com/dr-stone',
  raw: 'null',
  nu: 'https://www.novelupdates.com/series/null',
  kt: 'https://kitsu.io/manga/38860',
  ap: 'https://www.anime-planet.com/manga/dr-stone',
  al: 'https://anilist.co/manga/98416',
  chapters: [
    {
      title: 'Z=157: Same Time, Same Place',
      chapter_number: 157,
      release_date: 1593964800000,
      group: 'Shueisha',
      service_id: 1,
      chapter_url: '1007322',
    },
    {
      title: 'Z=156: Two Scientists',
      chapter_number: 156,
      release_date: null,
      group: 'MangaPlus',
      service_id: 2,
      chapter_url: '938629',
    },
    {
      title: 'Z=156: Two Scientists',
      chapter_number: 156,
      release_date: 1593187200000,
      group: 'Shueisha',
      service_id: 1,
      chapter_url: '1007024',
    },
  ],
};

beforeEach(() => {
  mockNotistackHooks();
});

describe('Manga admin page should render correctly', () => {
  mockUTCDates();
  fetchMock.get('*', []);

  it('should render correctly without data', async () => {
    let baseElement;
    await act(async () => {
      ({ baseElement } = render(<MangaAdmin mangaData={{}} />));
    });

    expect(baseElement).toMatchSnapshot();
  });

  it('should render correctly with data', async () => {
    let baseElement;
    await act(async () => {
      ({ baseElement } = render(<MangaAdmin mangaData={manga} />));
    });

    expect(baseElement).toMatchSnapshot();
  });
});

describe('Manga admin page should handle data fetching correctly', () => {
  const mockServices = manga.services.map(s => ({
    service_id: s.service_id,
    manga_id: manga.manga_id,
  }));
  const getMock = jest.fn().mockReturnValue({ data: mockServices });

  beforeEach(() => {
    fetchMock.reset();
    fetchMock.get(`/api/admin/manga/${manga.manga_id}/scheduledRuns`, getMock);
  });

  const renderPage = async () => {
    await act(async () => {
      render(<MangaAdmin mangaData={manga} />);
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

    manga.services.forEach(s => {
      expect(screen.getByText(s.name)).toBeTruthy();
    });
  });

  it('Should call the correct endpoint on adding new run', async () => {
    const serviceId = manga.services[0].service_id;
    const serviceName = manga.services[0].name;
    const postMock = jest.fn().mockReturnValue({ inserted: { service_id: serviceId, name: serviceName }});
    const partialGetMock = jest.fn().mockReturnValue({ data: mockServices.slice(1, 2) });

    fetchMock.post(`/api/admin/manga/${manga.manga_id}/scheduledRun/${serviceId}`, postMock);
    fetchMock.get(`/api/admin/manga/${manga.manga_id}/scheduledRuns`, partialGetMock, { overwriteRoutes: true });

    await act(async () => {
      render(<MangaAdmin mangaData={manga} />);
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
    const serviceId = manga.services[0].service_id;
    const serviceName = manga.services[0].name;
    const deleteMock = jest.fn().mockReturnValue({});

    fetchMock.delete(`/api/admin/manga/${manga.manga_id}/scheduledRun/${serviceId}`, deleteMock);

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
    const serviceId = manga.services[0].service_id;
    const serviceName = manga.services[0].name;

    fetchMock.delete(`/api/admin/manga/${manga.manga_id}/scheduledRun/${serviceId}`, 500);
    fetchMock.post(`/api/admin/manga/${manga.manga_id}/scheduledRun/${serviceId}`, 500);

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
