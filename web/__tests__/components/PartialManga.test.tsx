import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockUTCDates } from '@/tests/utils';
import PartialManga from '@/components/PartialManga';
import { emptyFullManga as emptyManga, fullManga as manga } from '@/tests/constants';
import type { FullMangaData } from '@/types/api/manga';


describe('Partial manga should render correctly', () => {
  mockUTCDates();

  const assertCorrectRender = (mangaData: FullMangaData['manga'], hasCover = true) => {
    // Find title
    expect(
      within(screen.getByLabelText('manga title'))
        .getByText(mangaData.title)
    ).toBeTruthy();

    // Find cover
    if (hasCover) {
      const cover = screen.getByAltText(mangaData.title);
      expect(screen.getByAltText(mangaData.title).getAttribute('src')).toStartWith('/_next/image?url=' + encodeURIComponent(mangaData.cover!));
      expect(cover.closest('a')!.getAttribute('href')).toBe(`/manga/${mangaData.mangaId}`);
    }

    // Find source list
    expect(screen.getByLabelText('manga sources')).toBeTruthy();

    // Find at least a part of the manga info component
    expect(
      screen.getByRole('row', { name: /latest release: /i })
    ).toBeTruthy();
  };

  it('Should render correctly with no input', () => {
    const { container } = render(<PartialManga />);

    expect(container).toBeEmptyDOMElement();
  });

  it('Should render correctly with input', () => {
    render(<PartialManga manga={manga.manga} services={manga.services} />);

    assertCorrectRender(manga.manga);
  });

  it('Should render correctly with minimal input', () => {
    render(<PartialManga manga={emptyManga.manga} />);

    assertCorrectRender(emptyManga.manga, false);
  });

  it('Should render correctly when showId is true', () => {
    render(<PartialManga manga={manga.manga} showId />);

    assertCorrectRender(manga.manga);

    const idRow = within(screen.getByText(/manga id/i).closest('tr')!);
    expect(
      idRow.getByRole('cell', { name: manga.manga.mangaId.toString() })
    ).toBeTruthy();
  });
});
