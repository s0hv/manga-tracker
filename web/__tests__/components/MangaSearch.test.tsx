import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MangaSearch from '@/components/MangaSearch';


fetchMock.config.overwriteRoutes = true;
vi.mock('@tanstack/react-router');

beforeEach(() => fetchMock.reset());

describe('Search should render correctly', () => {
  it('without input', () => {
    render(<MangaSearch />);

    expect(screen.getByRole('combobox', { name: 'manga search' })).toBeInTheDocument();
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
    const searchFn = vi.fn().mockImplementation(() => mockResult);

    fetchMock.mock('glob:/api/quicksearch?query=*', searchFn);

    render(<MangaSearch />);

    // Find search input
    const input = screen.getByRole('combobox');

    const user = userEvent.setup();
    // Simulate text changes and test that the quicksearch endpoint wasn't called
    await user.type(input, 'test search');
    await waitFor(() => expect(searchFn).toHaveBeenCalled());

    const listItems = screen.getAllByRole('option');
    expect(listItems).toHaveLength(mockResult.length);
    // Order is important as the first result is the most likely
    expect(listItems.map(l => l.textContent))
      .toEqual(mockResult.map(r => r.title));
  });
});

describe('Search should behave correctly with user input', () => {
  it('Should not do requests of under 3 characters', async () => {
    const searchFn = vi.fn().mockImplementation(() => []);

    fetchMock.mock('glob:/api/quicksearch?query=*', searchFn);

    render(<MangaSearch />);

    // Find search input
    const input = screen.getByRole('combobox');

    const user = userEvent.setup();
    // Simulate text changes and test that the quicksearch endpoint wasn't called
    await user.type(input, 'a{backspace}b{backspace}');

    // Wait a bit to make sure no request was made
    await new Promise(resolve => setTimeout(resolve, 500));

    expect(searchFn).toHaveBeenCalledTimes(0);
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('Should do a request with 2 or more characters', async () => {
    const searchFn = vi.fn().mockImplementation(() => []);

    fetchMock.mock('glob:/api/quicksearch?query=*', searchFn);

    render(<MangaSearch />);

    // Find search input
    const input = screen.getByRole('combobox');

    const user = userEvent.setup();
    // Simulate text changes
    await user.type(input, 'ab');
    await vi.waitFor(() => expect(searchFn).toHaveBeenCalledTimes(1));
  });

  it('Should throttle fast requests', async () => {
    const searchFn = vi.fn().mockImplementation(() => []);

    fetchMock.mock('glob:/api/quicksearch?query=*', searchFn);

    render(<MangaSearch />);

    // Find search input
    const input = screen.getByRole('combobox');
    const user = userEvent.setup();

    // Simulate text changes and test that the quicksearch endpoint
    // was called only once
    await user.type(input, 'ab');
    await user.type(input, 'cd');

    await vi.waitFor(() => expect(searchFn).toHaveBeenCalledTimes(1));
    expect(fetchMock.called('glob:/api/quicksearch?query=*', { query: {
      query: 'abcd',
    }})).toBeTrue();
  });
});
