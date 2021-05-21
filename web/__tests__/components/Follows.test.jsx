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
      mangaId: 1,
      latestChapter: 90,
      latestRelease: '2020-08-20T15:36:07.865Z',
      services: [
        {
          serviceId: 1,
          serviceName: 'MANGA Plus',
          titleId: '100010',
          url: 'https://mangaplus.shueisha.co.jp/titles/{}',
        },
        {
          serviceId: 2,
          serviceName: 'MangaDex',
          titleId: '20882',
          url: 'https://mangadex.org/title/{}',
        },
      ],
      followedServices: [
        1,
        null,
      ],
    },
    {
      title: 'Shuumatsu no Valkyrie',
      cover: 'https://mangadex.org/images/manga/33537.jpg?1591183509',
      mangaId: 8,
      services: [
        {
          serviceId: 2,
          serviceName: 'MangaDex',
          titleId: '33537',
          url: 'https://mangadex.org/title/{}',
        },
      ],
      followedServices: [
        null,
      ],
    },
    {
      title: 'Kengan Omega',
      cover: 'https://mangadex.org/images/manga/33538.jpg?1593474917',
      mangaId: 64,
      latestChapter: 10,
      services: [
        {
          serviceId: 2,
          serviceName: 'MangaDex',
          titleId: '33538',
          url: 'https://mangadex.org/title/{}',
        },
      ],
      followedServices: [
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
