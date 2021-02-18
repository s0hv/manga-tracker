import React from 'react';
import renderer from 'react-test-renderer';
import Follows from '../../src/components/Follows';
import { mockUTCDates } from '../utils';

mockUTCDates();

describe('Follows page should render correctly', () => {
  const follows = [
    {
      title: 'Dr. STONE',
      cover: 'https://mangadex.org/images/manga/20882.jpg?1585634146',
      manga_id: 1,
      latest_chapter: 90,
      latest_release: '2020-08-20T15:36:07.865Z',
      services: [
        {
          service_id: 1,
          service_name: 'MANGA Plus',
          title_id: '100010',
          url: 'https://mangaplus.shueisha.co.jp/titles/{}',
        },
        {
          service_id: 2,
          service_name: 'MangaDex',
          title_id: '20882',
          url: 'https://mangadex.org/title/{}',
        },
      ],
      followed_services: [
        1,
        null,
      ],
    },
    {
      title: 'Shuumatsu no Valkyrie',
      cover: 'https://mangadex.org/images/manga/33537.jpg?1591183509',
      manga_id: 8,
      services: [
        {
          service_id: 2,
          service_name: 'MangaDex',
          title_id: '33537',
          url: 'https://mangadex.org/title/{}',
        },
      ],
      followed_services: [
        null,
      ],
    },
    {
      title: 'Kengan Omega',
      cover: 'https://mangadex.org/images/manga/33538.jpg?1593474917',
      manga_id: 64,
      latest_chapter: 10,
      services: [
        {
          service_id: 2,
          service_name: 'MangaDex',
          title_id: '33538',
          url: 'https://mangadex.org/title/{}',
        },
      ],
      followed_services: [
        null,
      ],
    },
  ];

  it('should render correctly without follows', () => {
    const tree = renderer
      .create(<Follows />)
      .toJSON();

    expect(tree).toMatchSnapshot();
  });

  it('should render correctly with follows', () => {
    const tree = renderer
      .create(<Follows follows={follows} />)
      .toJSON();

    expect(tree).toMatchSnapshot();
  });
});
