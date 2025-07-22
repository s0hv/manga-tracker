import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockUTCDates } from '@/tests/utils';
import Follows from '@/components/Follows';
import type { Follow } from '@/types/db/follows';

mockUTCDates();

describe('Follows page should render correctly', () => {
  const follows: Follow[] = [
    {
      title: 'Dr. STONE',
      cover: '/images/test.png',
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
      cover: '/images/test2.png',
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
      cover: '/images/test3.png',
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

  it('should render no text without follows', () => {
    render(<Follows />);
    expect(screen.queryByText(/.+/)).not.toBeInTheDocument();
  });

  it('should render correctly with follows', () => {
    render(<Follows follows={follows} />);

    expect(follows.length).toBeGreaterThan(0);

    follows.forEach(follow => {
      const elem = within(screen.getByText(follow.title).parentElement!);

      if (!follow.latestRelease) {
        expect(elem.getByRole('row', { name: /latest release: unknown/i })).toBeInTheDocument();
      } else {
        expect(elem.getByRole('row', { name: /latest release: \d+ \w+ ago/i })).toBeInTheDocument();
      }

      if (!follow.latestChapter) {
        expect(elem.getByRole('row', { name: /latest chapter: no chapters/i })).toBeInTheDocument();
      } else {
        expect(elem.getByRole('row', { name: /latest chapter: \d+/i })).toBeInTheDocument();
      }

      const serviceList = within(elem.getByLabelText('manga services'));
      expect(serviceList.getByText(/all services/i)).toBeInTheDocument();
      follow.services.forEach(service => {
        expect(serviceList.getByText(service.serviceName)).toBeInTheDocument();
      });

      expect(serviceList.getAllByRole('button', { name: /(un)?follow/i })).toHaveLength(follow.services.length + 1);
    });
  });
});
