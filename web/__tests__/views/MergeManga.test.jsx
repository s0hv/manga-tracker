import React from 'react';
import fetchMock from 'fetch-mock';
import { render, screen, act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MergeManga from '../../src/views/MergeManga';
import { fullManga, emptyFullManga } from '../constants';

describe('Merge manga page should render correctly', () => {
  const mockResult = [
    {
      mangaId: 1,
      title: fullManga.manga.title,
    },
    {
      mangaId: 2,
      title: emptyFullManga.manga.title,
    },
  ];

  fetchMock.mock('glob:/api/quicksearch?query=*', mockResult);
  fetchMock.mock(`glob:/api/manga/${fullManga.manga.mangaId}`, { data: fullManga });
  fetchMock.mock(`glob:/api/manga/${emptyFullManga.manga.mangaId}`, { data: emptyFullManga });

  const selectItem = async (user, item) => {
    await waitFor(() => expect(
      screen.getByRole('option', { name: item.title })
    ).toBeInTheDocument());

    await act(async () => {
      await user.click(screen.getByRole('option', { name: item.title }));
    });
  };

  const triggerSearch = async (user, elem) => {
    await act(async () => {
      await user.type(elem, 'test', { delay: 1 });
    });
  };

  const selectAndAssert = async (user, item, base = true) => {
    const searchLabel = base ? 'search base manga' : 'search manga to merge';
    const searchBase = screen.getByLabelText(searchLabel);
    await triggerSearch(user, searchBase);

    await selectItem(user, item);
    const mangaLabel = base ? 'base manga' : 'manga to merge';
    expect(screen.getByLabelText(mangaLabel)).toBeInTheDocument();
  };

  it('should render correctly with different manga', async () => {
    render(<MergeManga />);

    // Make sure manga sections were not rendered
    expect(screen.queryByLabelText('base manga')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('manga to merge')).not.toBeInTheDocument();

    const user = userEvent.setup();

    // Search and select manga for both slots
    await selectAndAssert(user, mockResult[0]);
    await selectAndAssert(user, mockResult[1], false);

    // Make sure the elements that are used to do the merge are visible
    // Service select
    expect(screen.getByRole('radiogroup', { name: 'merge services' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^all services$/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: emptyFullManga.services[0].name })).toBeInTheDocument();

    // Merge button
    expect(screen.getByRole('button', { name: `merge ${mockResult[1].title} into ${mockResult[0].title}` }));
  });

  it('Should not show merge button with same manga', async () => {
    render(<MergeManga />);

    const user = userEvent.setup();

    // Search and select manga for both slots
    await selectAndAssert(user, mockResult[0]);
    await selectAndAssert(user, mockResult[0], false);

    // Make sure merge controls are not visible
    expect(screen.queryByRole('radiogroup', { name: 'merge services' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /merge .+? into .+?/ })).not.toBeInTheDocument();
  });

  it('Should not show merge button with one manga', async () => {
    render(<MergeManga />);
    const user = userEvent.setup();

    // Search and select manga for both slots
    await selectAndAssert(user, mockResult[0]);

    // Make sure merge controls are not visible
    expect(screen.queryByRole('radiogroup', { name: 'merge services' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /merge .+? into .+?/ })).not.toBeInTheDocument();
  });

  it('Should merge correctly', async () => {
    const url = 'glob:/api/manga/merge?*';
    fetchMock.mock(url, { aliasCount: 1, chapterCount: 1 });

    render(<MergeManga />);
    const user = userEvent.setup();

    // Search and select manga for both slots
    await selectAndAssert(user, mockResult[0]);
    await selectAndAssert(user, mockResult[1], false);

    await user.click(
      screen.getByRole('radio', { name: emptyFullManga.services[0].name })
    );

    const mergeBtn = screen.getByRole('button', { name: /merge .+? into .+?/ });

    await act(async () => {
      await user.click(mergeBtn);
    });

    expect(
      fetchMock.called(url, { query: {
        base: mockResult[0].mangaId.toString(),
        toMerge: mockResult[1].mangaId.toString(),
        service: emptyFullManga.services[0].serviceId.toString(),
      },
      method: 'post' })
    ).toBeTrue();

    expect(
      within(screen.getByLabelText('merge result'))
        .getByText(/moved \d+ alias\(es\) and \d+ chapter\(s\)/i)
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('manga to merge')).not.toBeInTheDocument();
  });
});
