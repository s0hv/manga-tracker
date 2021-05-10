import React from 'react';
import fetchMock from 'fetch-mock';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MergeManga from '../../src/views/MergeManga';
import { fullManga, emptyFullManga } from '../constants';

describe('Merge manga page should render correctly', () => {
  const mockResult = [
    {
      manga_id: 1,
      title: fullManga.manga.title,
    },
    {
      manga_id: 2,
      title: emptyFullManga.manga.title,
    },
  ];

  fetchMock.mock('glob:/api/quicksearch?query=*', mockResult);
  fetchMock.mock(`glob:/api/manga/${fullManga.manga.manga_id}`, { data: fullManga });
  fetchMock.mock(`glob:/api/manga/${emptyFullManga.manga.manga_id}`, { data: emptyFullManga });

  const selectItem = async (item) => {
    await waitFor(() => expect(
      screen.getByRole('option', { name: item.title })
    ).toBeInTheDocument());

    await act(async () => {
      userEvent.click(screen.getByRole('option', { name: item.title }));
    });
  };

  const triggerSearch = async (elem) => {
    await act(async () => {
      await userEvent.type(elem, 'test', { delay: 1 });
    });
  };

  const selectAndAssert = async (item, base = true) => {
    const searchLabel = base ? 'search base manga' : 'search manga to merge';
    const searchBase = screen.getByLabelText(searchLabel);
    await triggerSearch(searchBase);

    await selectItem(item);
    const mangaLabel = base ? 'base manga' : 'manga to merge';
    expect(screen.getByLabelText(mangaLabel)).toBeInTheDocument();
  };

  it('should render correctly with different manga', async () => {
    render(<MergeManga />);

    // Make sure manga sections were not rendered
    expect(screen.queryByLabelText('base manga')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('manga to merge')).not.toBeInTheDocument();

    // Search and select manga for both slots
    await selectAndAssert(mockResult[0]);
    await selectAndAssert(mockResult[1], false);

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

    // Search and select manga for both slots
    await selectAndAssert(mockResult[0]);
    await selectAndAssert(mockResult[0], false);

    // Make sure merge controls are not visible
    expect(screen.queryByRole('radiogroup', { name: 'merge services' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /merge .+? into .+?/ })).not.toBeInTheDocument();
  });

  it('Should not show merge button with one manga', async () => {
    render(<MergeManga />);

    // Search and select manga for both slots
    await selectAndAssert(mockResult[0]);

    // Make sure merge controls are not visible
    expect(screen.queryByRole('radiogroup', { name: 'merge services' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /merge .+? into .+?/ })).not.toBeInTheDocument();
  });
});
