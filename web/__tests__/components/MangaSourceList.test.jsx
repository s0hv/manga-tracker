import React from 'react';
import { createMount, createShallow } from '@material-ui/core/test-utils';
import { createSerializer } from 'enzyme-to-json';
import 'jest-extended';
import { Collapse } from '@material-ui/core';

import MangaSourceList from '../../src/components/MangaSourceList';
import { normalUser, withUser } from '../utils';

expect.addSnapshotSerializer(createSerializer({ mode: 'deep' }));


const services = [
  {
    title_id: '100010',
    service_id: 1,
    name: 'MANGA Plus',
    url: 'https://mangaplus.shueisha.co.jp/titles/{}',
  },
  {
    title_id: '20882',
    service_id: 2,
    name: 'MangaDex',
    url: 'https://mangadex.org/title/{}',
  },
  {
    title_id: 'test_series_1',
    service_id: 3,
    name: 'TestService',
    url: 'https://test.com/manga/{}',
  },
];

const follows = [1];


describe('Manga source list', () => {
  it('Should render correctly without input', () => {
    const wrapper = createMount()(<MangaSourceList />);

    expect(wrapper).toMatchSnapshot();
  });

  it('Should render correctly with items without user', () => {
    const wrapper = createMount()(
      <MangaSourceList
        items={services}
        classesProp={['test-class-1', 'test-class-2']}
        openByDefault
      />
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('Should render correctly with items and user', async () => {
    const elem = await withUser(normalUser, (
      <MangaSourceList
        items={services}
        userFollows={follows}
        classesProp={['test-class-1', 'test-class-2']}
        openByDefault
      />
    ));

    const wrapper = createMount()(elem);
    expect(wrapper).toMatchSnapshot();
  });

  it('should fail to render with invalid services', () => {
    // At the moment missing name or service id don't throw errors
    const invalid = [{
      title_id: 'test_series_1',
      service_id: 3,
    }];

    expect(() => createShallow()(
      <MangaSourceList
        items={invalid}
        classesProp={['test-class-1', 'test-class-2']}
      />
    )).toThrow();
  });
});


describe('Manga source list should handle user input', () => {
  it('Should call follow function on click', async () => {
    const followUnfollow = jest.fn();
    const createEvent = jest.fn();
    createEvent.mockImplementation(() => followUnfollow);

    const elem = await withUser(normalUser, (
      <MangaSourceList
        items={services}
        userFollows={follows}
        classesProp={['test-class-1', 'test-class-2']}
        followUnfollow={createEvent}
        openByDefault
      />
    ));

    const wrapper = createMount()(elem);
    expect(createEvent).toHaveBeenCalledTimes(services.length);
    expect(followUnfollow).toHaveBeenCalledTimes(0);

    wrapper.find('button').first().simulate('click');
    expect(followUnfollow).toHaveBeenCalledTimes(1);
  });

  it('Should open and close collapsed list on clicks', async () => {
    const elem = await withUser(normalUser, (
      <MangaSourceList
        items={services}
        userFollows={follows}
        classesProp={['test-class-1', 'test-class-2']}
      />
    ));

    const wrapper = createMount()(elem);
    expect(wrapper.exists('button')).toBeFalse();

    wrapper.find('div[role="button"]').simulate('click');

    expect(wrapper.exists('button')).toBeTrue();

    wrapper.find('div[role="button"]').simulate('click');

    // Make sure collapse was updated to false
    expect(wrapper.find(Collapse).exists({ in: false })).toBeTrue();
  });
});
