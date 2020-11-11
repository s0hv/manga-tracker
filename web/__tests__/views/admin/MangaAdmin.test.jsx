import React from 'react';
import { act, create } from 'react-test-renderer';
import fetchMock from 'fetch-mock';

import { mockNotistackHooks, mockUTCDates } from '../../utils';
import MangaAdmin from '../../../src/views/admin/MangaAdmin';


describe('Services page should render correctly', () => {
  mockUTCDates();
  mockNotistackHooks();
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
  fetchMock.get('*', []);

  it('should render correctly without data', async () => {
    let tree;
    await act(async () => {
      tree = create(<MangaAdmin mangaData={{}} />);
    });

    expect(tree).toMatchSnapshot();
  });

  it('should render correctly with data', async () => {
    let tree;
    await act(async () => {
      tree = create(<MangaAdmin mangaData={manga} />);
    });

    expect(tree).toMatchSnapshot();
  });
});
