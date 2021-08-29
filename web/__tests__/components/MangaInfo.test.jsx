import React from 'react';
import { render, screen } from '@testing-library/react';

import MangaInfo from '../../src/components/MangaInfo';
import { mockUTCDates } from '../utils';
import {
  defaultDateFormatRegex,
  defaultDateDistanceFormat
} from '../constants';

describe('MangaInfo should render correctly', () => {
  mockUTCDates();
  const mangaData = {
    mangaId: 1,
    releaseInterval: {
      days: 7,
    },
    latestRelease: '2020-07-05T16:00:00.000Z',
    estimatedRelease: '2020-07-12T16:00:00.000Z',
    latestChapter: 157,
    status: 0,
  };

  const nullData = {
    mangaId: 1,
    status: 0,
  };

  it('Should render correctly with data', () => {
    render(<MangaInfo mangaData={mangaData} />);

    expect(screen.queryByRole('row', { name: /manga id: \d+/i })).not.toBeInTheDocument();

    expect(
      screen.getByRole(
        'row',
        { name: new RegExp(`latest release: ${defaultDateFormatRegex} - ${defaultDateDistanceFormat}`, 'i') }
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole('row', { name: /estimated release interval: \d+ days \d+ hours/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole(
        'row',
        { name: new RegExp(`estimated next release: ${defaultDateFormatRegex}`, 'i') }
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('row', { name: /latest chapter: \d+/i })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /publication status: \w+/i })).toBeInTheDocument();
  });

  it('Should render correctly with null data', () => {
    render(<MangaInfo mangaData={nullData} showId />);

    expect(screen.queryByRole('row', { name: /manga id: \d+/i })).toBeInTheDocument();

    expect(
      screen.getByRole('row', { name: /latest release: unknown/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('row', { name: /estimated release interval: unknown/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('row', { name: /estimated next release: unknown/i })
    ).toBeInTheDocument();

    expect(screen.getByRole('row', { name: /latest chapter: unknown/i })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /publication status: \w+/i })).toBeInTheDocument();
  });

  it('Should throw TypeError when mangaData not given', () => {
    expect(() => render(<MangaInfo />)).toThrow(TypeError);
  });
});
