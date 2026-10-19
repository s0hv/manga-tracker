import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  expectRequestCalledWith,
  mockRequestJson,
  setupMockServer,
  TestRoot,
} from '../utils';
import MangaSearch, { type MangaSearchProps } from '@/components/MangaSearch';
import type { SearchedManga } from '@/types/api/manga';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock('@tanstack/react-router', async () => ({
  ...await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router'),
  useNavigate: () => navigateMock,
}));

const server = setupMockServer();

// Fix MUI warning spam https://github.com/mui/material-ui/issues/47792#issuecomment-3924961278
(globalThis as any).MUI_TEST_ENV = true;

const doRender = (props: MangaSearchProps = {}) => render(
  <TestRoot>
    <MangaSearch {...props} />
  </TestRoot>
);

const searchResults: SearchedManga[] = [
  { mangaId: 1, title: 'Test 1', score: 1 },
  { mangaId: 2, title: 'Test 2', score: 1 },
];

const searchPageNavigation = (query: string) => ({
  to: '/manga/search',
  search: { query },
});

const mangaPageNavigation = (mangaId: number) => ({
  to: '/manga/$mangaId',
  params: { mangaId: mangaId.toString() },
});

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

describe('Search should navigate correctly', () => {
  const typeAndWaitForOptions = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
    await user.type(screen.getByRole('combobox'), text);
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(searchResults.length));
  };

  it('Navigates to the clicked manga', async () => {
    mockRequestJson(server, '/api/quicksearch', searchResults);
    doRender({ redirectToSearch: true });
    const user = userEvent.setup();

    await typeAndWaitForOptions(user, 'test');
    await user.click(screen.getByRole('option', { name: 'Test 2' }));

    expect(navigateMock).toHaveBeenCalledExactlyOnceWith(mangaPageNavigation(2));
  });

  it('Selects the first option on enter without redirectToSearch', async () => {
    mockRequestJson(server, '/api/quicksearch', searchResults);
    doRender();
    const user = userEvent.setup();

    await typeAndWaitForOptions(user, 'test');
    await user.keyboard('{Enter}');

    expect(navigateMock).toHaveBeenCalledExactlyOnceWith(mangaPageNavigation(1));
  });

  it('Redirects to the search page on enter with redirectToSearch', async () => {
    mockRequestJson(server, '/api/quicksearch', searchResults);
    doRender({ redirectToSearch: true });
    const user = userEvent.setup();

    await typeAndWaitForOptions(user, 'test search');
    await user.keyboard('{Enter}');

    expect(navigateMock).toHaveBeenCalledExactlyOnceWith(searchPageNavigation('test search'));

    // The query stays in the input, but the input loses focus to close the options
    const input = screen.getByRole('combobox');
    expect(input).toHaveValue('test search');
    expect(input).not.toHaveFocus();
  });

  it('Navigates to the option highlighted with the keyboard on enter with redirectToSearch', async () => {
    mockRequestJson(server, '/api/quicksearch', searchResults);
    doRender({ redirectToSearch: true });
    const user = userEvent.setup();

    await typeAndWaitForOptions(user, 'test search');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(navigateMock).toHaveBeenCalledExactlyOnceWith(mangaPageNavigation(2));
  });

  it('Does not redirect to the search page on enter with less than 2 characters', async () => {
    mockRequestJson(server, '/api/quicksearch', []);
    doRender({ redirectToSearch: true });
    const user = userEvent.setup();

    await user.type(screen.getByRole('combobox'), ' a {Enter}');

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('Redirects to the search page when clicking the search button with redirectToSearch', async () => {
    mockRequestJson(server, '/api/quicksearch', searchResults);
    doRender({ redirectToSearch: true });
    const user = userEvent.setup();

    await typeAndWaitForOptions(user, 'test search');
    await user.click(screen.getByRole('button'));

    expect(navigateMock).toHaveBeenCalledExactlyOnceWith(searchPageNavigation('test search'));
  });

  it('Does nothing when clicking the search button with a too short query', async () => {
    mockRequestJson(server, '/api/quicksearch', []);
    doRender({ redirectToSearch: true });
    const user = userEvent.setup();

    await user.type(screen.getByRole('combobox'), 'a');
    await user.click(screen.getByRole('button'));

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('Does nothing when clicking the search button without redirectToSearch', async () => {
    mockRequestJson(server, '/api/quicksearch', searchResults);
    doRender();
    const user = userEvent.setup();

    await typeAndWaitForOptions(user, 'test search');
    await user.click(screen.getByRole('button'));

    expect(navigateMock).not.toHaveBeenCalled();
  });
});
