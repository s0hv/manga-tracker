import React from 'react';
import { QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import {
  mockAllIsIntersecting,
  resetIntersectionMocking,
  setupIntersectionMocking,
} from 'react-intersection-observer/test-utils';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  handleMockRequest,
  mockRequestJson,
  setupMockServer,
  TestRoot,
} from '@/tests/utils';
import { MangaStatus } from '@/common/mangaStatus';
import { MangaSearchResultPage } from '@/components/manga/MangaSearch/MangaSearchResultPage';
import { testServices } from '@/tests/constants';

vi.mock('@tanstack/react-router');

const server = setupMockServer();

// Fix MUI warning spam https://github.com/mui/material-ui/issues/47792#issuecomment-3924961278
(globalThis as any).MUI_TEST_ENV = true;

type SearchRequest = {
  url: string;
  params: Record<string, string>;
};

const createMangas = (startId: number, count: number) => new Array(count).fill(0).map((_, idx) => ({
  mangaId: startId + idx,
  title: `Manga ${startId + idx}`,
  // Without a cover the title would be rendered twice due to the cover placeholder
  coverUrl: 'https://example.com/cover.jpg',
  latestChapter: 10,
  latestRelease: '2020-07-05T16:00:00.000Z',
  status: MangaStatus.ONGOING,
  serviceIds: [1],
}));

/**
 * Mocks the search endpoint so that each request returns a page of `totalCount` generated mangas
 * based on the requested limit and offset. Requests with filters get `filteredCount` mangas instead.
 */
const mockSearch = (totalCount: number, filteredCount = totalCount) => {
  const searchFn = vi.fn<(req: SearchRequest) => unknown>().mockImplementation(({ params }) => {
    const count = (params.serviceIds || params.status) ? filteredCount : totalCount;
    const limit = Number(params.limit);
    const offset = Number(params.offset ?? 0);
    const pageSize = Math.max(0, Math.min(limit, count - offset));

    return HttpResponse.json({
      data: {
        searchResults: createMangas(offset + 1, pageSize),
        serviceIds: [1, 2],
      },
      count,
    });
  });

  server.use(http.get('/api/manga/search', handleMockRequest(searchFn)));

  return searchFn;
};

const lastRequestParams = (searchFn: ReturnType<typeof mockSearch>) => searchFn.mock.lastCall?.[0].params;

const doRender = (searchQuery = 'test') => {
  // The same client must be kept between rerenders, so the default one from TestRoot cannot be used.
  // Infinite gcTime prevents leftover garbage collection timers after the test.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }}});
  const getElement = (query: string) => (
    <TestRoot queryClient={queryClient}>
      <MangaSearchResultPage searchQuery={query} />
    </TestRoot>
  );

  const result = render(getElement(searchQuery));

  return {
    ...result,
    changeSearchQuery: (query: string) => result.rerender(getElement(query)),
  };
};

beforeEach(() => {
  setupIntersectionMocking(vi.fn);
  mockRequestJson(server, '/api/services', { data: testServices });
});

afterEach(() => {
  resetIntersectionMocking();
});

describe('MangaSearchResultPage', () => {
  it('Shows the search results for the query', async () => {
    const searchFn = mockSearch(2);
    doRender('test');

    expect(await screen.findByText('Manga 1')).toBeInTheDocument();
    expect(screen.getByText('Manga 2')).toBeInTheDocument();

    expect(searchFn).toHaveBeenCalledOnce();
    expect(lastRequestParams(searchFn)).toEqual({ query: 'test', limit: '20', offset: '0' });

    expect(screen.getByRole('heading', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByText('2 results for "test"')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('test');

    // Filters are shown for the services found in the results
    expect(await screen.findByRole('checkbox', { name: 'MANGA Plus' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'MangaDex' })).toBeInTheDocument();

    expect(screen.getByText('Reached the end')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('Loads the next page when the last result comes into view', async () => {
    const searchFn = mockSearch(25);
    doRender();

    expect(await screen.findByText('Manga 20')).toBeInTheDocument();
    expect(screen.queryByText('Manga 21')).not.toBeInTheDocument();
    expect(screen.getByText('25 results for "test"')).toBeInTheDocument();
    // More results are available
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('Reached the end')).not.toBeInTheDocument();

    act(() => mockAllIsIntersecting(true));

    expect(await screen.findByText('Manga 25')).toBeInTheDocument();
    expect(searchFn).toHaveBeenCalledTimes(2);
    expect(lastRequestParams(searchFn)).toEqual({ query: 'test', limit: '20', offset: '20' });

    expect(screen.getAllByRole('link', { name: /^Manga \d+$/ })).toHaveLength(25 * 2);
    expect(await screen.findByText('Reached the end')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('Does not load more pages without scrolling to the end', async () => {
    const searchFn = mockSearch(25);
    doRender();

    expect(await screen.findByText('Manga 20')).toBeInTheDocument();
    act(() => mockAllIsIntersecting(false));

    // Give time for a possible extra request
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(searchFn).toHaveBeenCalledOnce();
  });

  it('Applies the selected filters to the search', async () => {
    const searchFn = mockSearch(3, 1);
    doRender();
    const user = userEvent.setup();

    expect(await screen.findByText('3 results for "test"')).toBeInTheDocument();

    await user.click(await screen.findByRole('checkbox', { name: 'MangaDex' }));
    await waitFor(() => expect(lastRequestParams(searchFn)).toEqual({
      query: 'test',
      serviceIds: '2',
      limit: '20',
      offset: '0',
    }));
    expect(await screen.findByText('1 results for "test"')).toBeInTheDocument();
    expect(screen.queryByText('Manga 2')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Completed' }));
    await user.click(screen.getByRole('checkbox', { name: 'Hiatus' }));
    await waitFor(() => expect(lastRequestParams(searchFn)).toEqual({
      query: 'test',
      serviceIds: '2',
      status: `${MangaStatus.COMPLETED},${MangaStatus.HIATUS}`,
      limit: '20',
      offset: '0',
    }));

    // Unselecting every filter shows the unfiltered results again
    await user.click(screen.getByRole('checkbox', { name: 'MangaDex' }));
    await user.click(screen.getByRole('checkbox', { name: 'Completed' }));
    await user.click(screen.getByRole('checkbox', { name: 'Hiatus' }));
    expect(await screen.findByText('3 results for "test"')).toBeInTheDocument();
    expect(screen.getByText('Manga 3')).toBeInTheDocument();
  });

  it('Searches with the query typed into the search field on enter', async () => {
    const searchFn = mockSearch(2);
    doRender('test');
    const user = userEvent.setup();

    expect(await screen.findByText('2 results for "test"')).toBeInTheDocument();
    const searchField = screen.getByRole('textbox');

    // Queries shorter than 2 characters are ignored
    await user.clear(searchField);
    await user.type(searchField, ' a {Enter}');
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(searchFn).toHaveBeenCalledOnce();

    await user.clear(searchField);
    await user.type(searchField, 'new query');
    // Typing alone does not search
    expect(searchFn).toHaveBeenCalledOnce();

    await user.keyboard('{Enter}');

    await waitFor(() => expect(lastRequestParams(searchFn)).toEqual({
      query: 'new query',
      limit: '20',
      offset: '0',
    }));
    expect(await screen.findByText('2 results for "new query"')).toBeInTheDocument();
    expect(new URL(window.location.href).searchParams.get('query')).toBe('new query');
  });

  it('Keeps the selected filters when searching from the search field', async () => {
    const searchFn = mockSearch(2);
    doRender('test');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('checkbox', { name: 'Completed' }));
    await waitFor(() => expect(lastRequestParams(searchFn)?.status).toBe(`${MangaStatus.COMPLETED}`));

    const searchField = screen.getByRole('textbox');
    await user.clear(searchField);
    await user.type(searchField, 'new query{Enter}');

    await waitFor(() => expect(lastRequestParams(searchFn)).toEqual({
      query: 'new query',
      status: `${MangaStatus.COMPLETED}`,
      limit: '20',
      offset: '0',
    }));
  });

  it('Searches again when the search query changes', async () => {
    const searchFn = mockSearch(2);
    const { changeSearchQuery } = doRender('test');

    expect(await screen.findByText('2 results for "test"')).toBeInTheDocument();

    changeSearchQuery('other query');

    await waitFor(() => expect(lastRequestParams(searchFn)?.query).toBe('other query'));
    expect(await screen.findByText('2 results for "other query"')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('other query');
  });

  it('Keeps the shown filters in sync with the search when the search query changes', async () => {
    const searchFn = mockSearch(2);
    const { changeSearchQuery } = doRender('test');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('checkbox', { name: 'Completed' }));
    await waitFor(() => expect(lastRequestParams(searchFn)?.status).toBe(`${MangaStatus.COMPLETED}`));

    changeSearchQuery('other query');
    await waitFor(() => expect(lastRequestParams(searchFn)?.query).toBe('other query'));

    // Either the filter is cleared or it is still applied, but the UI must match the request
    const isFilterChecked = screen.getByRole<HTMLInputElement>('checkbox', { name: 'Completed' }).checked;
    expect(lastRequestParams(searchFn)?.status !== undefined).toBe(isFilterChecked);
  });
});
