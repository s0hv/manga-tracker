import React from 'react';
import { create } from 'react-test-renderer';

import MangaInfo from '../../src/components/MangaInfo';
import { mockUTCDates } from '../utils';

describe('MangaInfo should render correctly', () => {
  mockUTCDates();
  const mangaData = {
    release_interval: {
      days: 7,
    },
    latest_release: '2020-07-05T16:00:00.000Z',
    estimated_release: '2020-07-12T16:00:00.000Z',
    latest_chapter: 157,
    status: 0,
  };

  it('Should render correctly with data', () => {
    expect(create(<MangaInfo mangaData={mangaData} />)).toMatchSnapshot();
  });

  it('Should throw TypeError when mangaData not given', () => {
    expect(() => create(<MangaInfo />)).toThrow(TypeError);
  });
});
