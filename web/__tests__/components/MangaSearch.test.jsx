import React from 'react';
import { act } from 'react-dom/test-utils';
import { createMount } from '@material-ui/core/test-utils';
import fetchMock from 'fetch-mock';
import { createSerializer } from 'enzyme-to-json';

import MangaSearch from '../../src/components/MangaSearch';

fetchMock.config.overwriteRoutes = true;
expect.addSnapshotSerializer(createSerializer({ mode: 'deep' }));


describe('Search should render correctly', () => {
  it('without input', () => {
    const tree = createMount()(<MangaSearch id='test-id' />);

    expect(tree).toMatchSnapshot();
  });

  it('with valid input', async () => {
    const mockResult = [
      {
        mangaId: 1,
        title: 'Test 1',
      },
      {
        mangaId: 2,
        title: 'Test 2',
      },
      {
        mangaId: 3,
        title: 'Test 3',
      },
    ];
    const searchFn = jest.fn().mockImplementation(() => mockResult);

    fetchMock.mock('glob:/api/quicksearch?query=*', searchFn);

    const wrapper = createMount()(
      <MangaSearch id='test-input-id' />
    );

    // Find search input
    const input = wrapper.find('input#test-input-id');
    expect(input).toHaveLength(1);

    // Simulate text changes and test that the quicksearch endpoint wasn't called
    await act(async () => {
      input.simulate('change', { target: { value: 'test search' }});
    });
    expect(searchFn).toHaveBeenCalledTimes(1);
    wrapper.update();

    const listItems = wrapper.find('li');
    expect(listItems).toHaveLength(mockResult.length);
    // Order is important as the first result is the most likely
    expect(listItems.map(l => l.text()))
      .toEqual(mockResult.map(r => r.title));
  });
});

describe('Search should behave correctly with user input', () => {
  it('Should not do requests of under 3 characters', () => {
    const searchFn = jest.fn().mockImplementation(() => []);

    fetchMock.mock('glob:/api/quicksearch?query=*', searchFn);

    const wrapper = createMount()(
      <MangaSearch id='test-input-id' />
    );

    // Find search input
    const input = wrapper.find('input#test-input-id');
    expect(input).toHaveLength(1);

    // Simulate text changes and test that the quicksearch endpoint wasn't called
    input.simulate('change', { target: { value: 'x' }});
    input.simulate('change', { target: { value: 'a' }});
    input.simulate('change', { target: { value: 'a' }});
    input.simulate('change', { target: { value: '' }});

    expect(searchFn).toHaveBeenCalledTimes(0);
  });

  it('Should do a request with 3 or more characters', async () => {
    const searchFn = jest.fn().mockImplementation(() => []);

    fetchMock.mock('glob:/api/quicksearch?query=*', searchFn);

    const wrapper = createMount()(
      <MangaSearch id='test-input-id' />
    );

    // Find search input
    const input = wrapper.find('input#test-input-id');
    expect(input).toHaveLength(1);

    // Simulate text changes and test that the quicksearch endpoint wasn't called
    await act(async () => {
      input.simulate('change', { target: { value: 'ab' }});
    });
    expect(searchFn).toHaveBeenCalledTimes(1);
  });

  it('Should throttle fast requests', async () => {
    const searchFn = jest.fn().mockImplementation(() => []);

    fetchMock.mock('glob:/api/quicksearch?query=*', searchFn);

    const wrapper = createMount()(
      <MangaSearch id='test-input-id' />
    );

    // Find search input
    const input = wrapper.find('input#test-input-id');
    expect(input).toHaveLength(1);

    // Simulate text changes and test that the quicksearch endpoint wasn't called
    await act(async () => {
      input.simulate('change', { target: { value: 'abc' }});
      input.simulate('change', { target: { value: 'abcd' }});
      input.simulate('change', { target: { value: 'abcde' }});
    });
    expect(searchFn).toHaveBeenCalledTimes(1);
  });
});
