import { createShallow } from '@material-ui/core/test-utils';
import React from 'react';
import Manga from '../../src/components/Manga';
import { emptyFullManga as emptyManga, fullManga as manga } from '../constants';
import { adminUser, mockUTCDates, normalUser, withUser } from '../utils';

describe('Manga page should render correctly', () => {
  mockUTCDates();
  const follows = [1];

  it('should render correctly', () => {
    const wrapper = createShallow()(
      <Manga mangaData={manga} />
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('should render correctly when logged in', async () => {
    const elem = await withUser(
      normalUser,
      <Manga mangaData={manga} follows={follows} />
    );
    const wrapper = createShallow()(elem).dive();

    expect(wrapper).toMatchSnapshot();
  });

  it('Should render correctly as admin', async () => {
    const elem = await withUser(
      adminUser,
      <Manga mangaData={manga} follows={follows} />
    );
    const wrapper = createShallow()(elem).dive();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render correctly with little data', () => {
    const wrapper = createShallow()(<Manga mangaData={emptyManga} />);

    expect(wrapper).toMatchSnapshot();
  });
});
