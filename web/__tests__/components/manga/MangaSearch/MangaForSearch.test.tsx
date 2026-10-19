import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getCoverUrl, TestRoot } from '@/tests/utils';
import { MangaStatus } from '@/common/mangaStatus';
import type { SearchedMangaSchema } from '@/common/schemas/manga';
import { MangaForSearch } from '@/components/manga/MangaSearch/MangaForSearch';

vi.mock('@tanstack/react-router');

const manga: SearchedMangaSchema = {
  mangaId: 1,
  title: 'Test manga',
  coverUrl: 'https://uploads.mangadex.org/covers/manga-id/cover-id.jpg',
  latestChapter: 157,
  latestRelease: new Date('2020-07-05T16:00:00.000Z'),
  status: MangaStatus.HIATUS,
  serviceIds: [1],
};

const doRender = (mangaData: SearchedMangaSchema, ref?: (elem: HTMLElement | null) => void) => render(
  <TestRoot>
    <MangaForSearch manga={mangaData} ref={ref} />
  </TestRoot>
);

describe('MangaForSearch', () => {
  it('Renders the manga info with links to the manga page', () => {
    doRender(manga);

    expect(screen.getByRole('img', { name: manga.title }))
      .toHaveAttribute('src', getCoverUrl(manga.coverUrl));
    expect(screen.getByText('Hiatus')).toBeInTheDocument();
    expect(screen.getByText(`Ch. ${manga.latestChapter}`)).toBeInTheDocument();
    // formatDistanceToNowStrict is mocked globally to return "1 day ago"
    expect(screen.getByText(/^1 day ago/)).toBeInTheDocument();

    // Both the cover and the title link to the manga
    const links = screen.getAllByRole('link', { name: manga.title });
    expect(links).toHaveLength(2);
    links.forEach(link => expect(link).toHaveAttribute('href', '/manga/$mangaId'));
  });

  it('Renders a placeholder and unknown release when data is missing', () => {
    doRender({
      ...manga,
      coverUrl: null,
      latestRelease: null,
      status: MangaStatus.COMPLETED,
    });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // The placeholder links to the manga page like the cover image does
    expect(screen.getAllByRole('link', { name: manga.title })).toHaveLength(2);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('Passes the ref to the root element', () => {
    const ref = vi.fn<(elem: HTMLElement | null) => void>();
    doRender(manga, ref);

    const elem = ref.mock.calls[0]?.[0];
    expect(elem).toBeInstanceOf(HTMLElement);
    expect(elem).toContainElement(screen.getByRole('img', { name: manga.title }));
    expect(elem).toContainElement(screen.getByText(`Ch. ${manga.latestChapter}`));
  });
});
