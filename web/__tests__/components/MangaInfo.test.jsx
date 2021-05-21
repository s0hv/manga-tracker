import React from 'react';
import { create } from 'react-test-renderer';

import MangaInfo from '../../src/components/MangaInfo';
import { mockUTCDates } from '../utils';

describe('MangaInfo should render correctly', () => {
  mockUTCDates();
  const mangaData = {
    releaseInterval: {
      days: 7,
    },
    latestRelease: '2020-07-05T16:00:00.000Z',
    estimatedRelease: '2020-07-12T16:00:00.000Z',
    latestChapter: 157,
    status: 0,
  };

  it('Should render correctly with data', () => {
    expect(create(<MangaInfo mangaData={mangaData} />)).toMatchSnapshot();
  });

  it('Should throw TypeError when mangaData not given', () => {
    expect(() => create(<MangaInfo />)).toThrow(TypeError);
  });
});
