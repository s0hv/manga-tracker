import React from 'react';
import renderer from 'react-test-renderer';
import PartialManga from '../../src/components/PartialManga';
import { emptyFullManga as emptyManga, fullManga as manga } from '../constants';

import { mockUTCDates } from '../utils';


describe('Partial manga should render correctly', () => {
  mockUTCDates();

  it('Should render correctly with no input', () => {
    const tree = renderer
      .create(<PartialManga />)
      .toJSON();

    expect(tree).toMatchSnapshot();
  });

  it('Should render correctly with input', () => {
    const tree = renderer
      .create(<PartialManga mangaData={manga.manga} />)
      .toJSON();

    expect(tree).toMatchSnapshot();
  });

  it('Should render correctly with minimal input', () => {
    const tree = renderer
      .create(<PartialManga mangaData={emptyManga.manga} />)
      .toJSON();

    expect(tree).toMatchSnapshot();
  });

  it('Should render correctly when showId is true', () => {
    const tree = renderer
      .create(<PartialManga mangaData={manga.manga} showId />)
      .toJSON();

    expect(tree).toMatchSnapshot();
  });
});
