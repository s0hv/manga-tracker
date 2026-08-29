import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  expectRequestCalledWith,
  mockRequestJson,
  setupMockServer, TestRoot,
} from '../utils';
import MangaSearch from '@/components/MangaSearch';
import type { SearchedManga } from '@/types/api/manga';

vi.mock('@tanstack/react-router');

const server = setupMockServer();

// Fix MUI warning spam https://github.com/mui/material-ui/issues/47792#issuecomment-3924961278
(globalThis as any).MUI_TEST_ENV = true;

const doRender = () => render(
  <TestRoot>
    <MangaSearch />
  </TestRoot>
);

describe('Search should render correctly', () => {
  it('without input', () => {
    doRender();

    expect(screen.getByRole('combobox', { name: 'manga search' })).toBeInTheDocument();
  });

  it('with valid input', async () => {
    const mockResult: SearchedManga[] = [
      {
        mangaId: 1,
        title: 'Test 1',
        score: 1,
      },
      {
        mangaId: 2,
        title: 'Test 2',
        score: 1,
      },
      {
        mangaId: 3,
        title: 'Test 3',
        score: 1,
      },
    ];

    const searchFn = mockRequestJson(server, '/api/quicksearch', mockResult);

    doRender();

    // Find search input
    const input = screen.getByRole('combobox');

    const user = userEvent.setup();
    // Simulate text changes and test that the quicksearch endpoint was called
    await user.type(input, 'test search');
    await waitFor(() => expectRequestCalledWith(
      searchFn,
      {
        url: '/api/quicksearch',
        searchParams: { query: 'test search', withServices: 'false' },
      }
    ));

    const listItems = screen.getAllByRole('option');
    expect(listItems).toHaveLength(mockResult.length);
    // Order is important as the first result is the most likely
    expect(listItems.map(l => l.textContent))
      .toEqual(mockResult.map(r => r.title));
  });
});

describe('Search should behave correctly with user input', () => {
  it('Should not do requests of under 3 characters', async () => {
    const searchFn = mockRequestJson(server, '/api/quicksearch', []);

    doRender();

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
    const searchFn = mockRequestJson(server, '/api/quicksearch', []);

    doRender();

    // Find search input
    const input = screen.getByRole('combobox');

    const user = userEvent.setup();
    // Simulate text changes
    await user.type(input, 'ab');
    await vi.waitFor(() => expect(searchFn).toHaveBeenCalledTimes(1));
  });

  it('Should throttle fast requests', async () => {
    const searchFn = mockRequestJson(server, '/api/quicksearch', []);

    doRender();

    // Find search input
    const input = screen.getByRole('combobox');
    const user = userEvent.setup();

    // Simulate text changes and test that the quicksearch endpoint
    // was called only once
    await user.type(input, 'ab');
    await user.type(input, 'cd');

    await vi.waitFor(() => expect(searchFn).toHaveBeenCalledTimes(1));

    expectRequestCalledWith(searchFn, {
      url: '/api/quicksearch',
      searchParams: {
        query: 'abcd',
        withServices: 'false',
      },
    });
  });
});
