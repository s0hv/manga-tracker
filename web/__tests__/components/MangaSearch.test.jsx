import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';

import MangaSearch from '../../src/components/MangaSearch';

fetchMock.config.overwriteRoutes = true;


describe('Search should render correctly', () => {
  it('without input', () => {
    render(<MangaSearch />);

    expect(screen.getByRole('textbox', { name: 'manga search' })).toBeInTheDocument();
    // Autocomplete has the role combobox
    expect(screen.getByRole('combobox')).toBeInTheDocument();
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

    render(<MangaSearch />);

    // Find search input
    const input = screen.getByRole('textbox');

    // Simulate text changes and test that the quicksearch endpoint wasn't called
    await act(async () => {
      await userEvent.type(input, 'test search', { delay: 1 });
    });
    expect(searchFn).toHaveBeenCalled();

    const listItems = screen.getAllByRole('option');
    expect(listItems).toHaveLength(mockResult.length);
    // Order is important as the first result is the most likely
    expect(listItems.map(l => l.textContent))
      .toEqual(mockResult.map(r => r.title));
  });
});

describe('Search should behave correctly with user input', () => {
  it('Should not do requests of under 3 characters', async () => {
    const searchFn = jest.fn().mockImplementation(() => []);

    fetchMock.mock('glob:/api/quicksearch?query=*', searchFn);

    render(<MangaSearch />);

    // Find search input
    const input = screen.getByRole('textbox');

    // Simulate text changes and test that the quicksearch endpoint wasn't called
    await act(async () => {
      await userEvent.type(input, 'a{backspace}b{backspace}c', { delay: 10 });
    });

    expect(searchFn).toHaveBeenCalledTimes(0);
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('Should do a request with 2 or more characters', async () => {
    const searchFn = jest.fn().mockImplementation(() => []);

    fetchMock.mock('glob:/api/quicksearch?query=*', searchFn);

    render(<MangaSearch />);

    // Find search input
    const input = screen.getByRole('textbox');

    // Simulate text changes
    await act(async () => {
      await userEvent.type(input, 'ab', { delay: 1 });
    });
    expect(searchFn).toHaveBeenCalledTimes(1);
  });

  it('Should throttle fast requests', async () => {
    const searchFn = jest.fn().mockImplementation(() => []);

    fetchMock.mock('glob:/api/quicksearch?query=*', searchFn);

    render(<MangaSearch />);

    // Find search input
    const input = screen.getByRole('textbox');

    // Simulate text changes and test that the quicksearch endpoint
    // was called only once
    await act(async () => {
      await userEvent.type(input, 'abcdef', { delay: 20 });
    });
    expect(searchFn).toHaveBeenCalledTimes(1);
    expect(fetchMock.called('glob:/api/quicksearch?query=*', { query: {
      query: 'ab',
    }})).toBeTrue();
  });
});
