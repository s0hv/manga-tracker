import React from 'react';
import { render, screen, act } from '@testing-library/react';
import fetchMock from 'fetch-mock';

import {
  adminUser,
  mockUTCDates,
  normalUser,
  withUser,
  mockNotistackHooks,
} from '../utils';
import Manga from '../../src/components/Manga';
import { emptyFullManga as emptyManga, fullManga as manga } from '../constants';

describe('Manga page should render correctly', () => {
  mockUTCDates();
  mockNotistackHooks();
  fetchMock.get('express:/api/manga/:mangaId/chapters', { chapters: []});
  fetchMock.get('express:/api/chapter/releases/:mangaId', []);

  const follows = [1];

  /**
   * Based on a condition checks whether an element should or
   * should not exist in the document
   * @param {boolean} shouldExist Condition, which if true, makes sure that the element exists
   * @param {import('@testing-library/react').ByRoleMatcher} role The role of the element
   * @param {import('@testing-library/react').ByRoleOptions} options
   */
  const conditionalInDocument = (shouldExist, role, options) => {
    if (shouldExist) {
      expect(screen.getByRole(role, options)).toBeInTheDocument();
    } else {
      expect(screen.queryByRole(role, options)).not.toBeInTheDocument();
    }
  };

  const expectTitleExists = (m) => {
    expect(
      screen.getByRole('heading', { name: m.manga.title })
    ).toBeInTheDocument();
  };

  const expectMangaInfoExists = (m) => {
    // With cover mal link and the cover should exist. Otherwise they should be hidden
    if (m.manga.cover) {
      const malLink = screen.getByRole('link', { name: /myanimelist page of the manga/i });
      expect(malLink).toBeInTheDocument();
      expect(malLink).toHaveAttribute('href', m.manga.mal);

      const coverImage = screen.getByRole('img', { name: m.manga.title });
      expect(coverImage).toBeInTheDocument();
      expect(coverImage).toHaveAttribute('src', `${m.manga.cover}.256.jpg`);
    } else {
      expect(screen.queryByRole('link', { name: /myanimelist page of the manga/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('img', { name: m.manga.title })).not.toBeInTheDocument();
    }

    if (m.aliases?.length > 0) {
      // Make sure the aliases are listed
      expect(screen.getByText(/alternative titles/i)).toBeInTheDocument();
      expect(screen.getByText(m.aliases[0], { exact: true })).toBeInTheDocument();
    } else {
      expect(screen.queryByText(/alternative titles/i)).not.toBeInTheDocument();
    }

    expect(screen.getByRole('table', { name: /manga information/i })).toBeInTheDocument();
  };

  const expectSourcesExist = (_) => {
    expect(screen.getByRole('list', { name: 'manga sources' })).toBeInTheDocument();
  };

  const expectAdminControls = (isAdmin) => {
    conditionalInDocument(isAdmin, 'button', { name: /admin page/i });

    conditionalInDocument(isAdmin, 'button', { name: /edit chapters/i });
  };

  const expectAuthenticatedFeatures = (isAuthenticated) => {
    conditionalInDocument(isAuthenticated, 'button', { name: /follow all releases/i });
  };

  it('should render correctly', async () => {
    await act(async () => {
      render(<Manga mangaData={manga} follows={follows} />);
    });

    expectTitleExists(manga);
    expectMangaInfoExists(manga);
    expectSourcesExist(manga);
    expectAdminControls(false);
    expectAuthenticatedFeatures(false);
  });

  it('should render correctly when logged in', async () => {
    await act(async () => {
      render(await withUser(
        normalUser,
        <Manga mangaData={manga} follows={follows} />
      ));
    });

    expectTitleExists(manga);
    expectMangaInfoExists(manga);
    expectSourcesExist(manga);
    expectAdminControls(false);
    expectAuthenticatedFeatures(true);
  });

  it('Should render correctly as admin', async () => {
    await act(async () => {
      render(await withUser(
        adminUser,
        <Manga mangaData={manga} follows={follows} />
      ));
    });

    expectTitleExists(manga);
    expectMangaInfoExists(manga);
    expectSourcesExist(manga);
    expectAdminControls(true);
    expectAuthenticatedFeatures(true);
  });

  it('should render correctly with little data', async () => {
    await act(async () => {
      render(<Manga mangaData={emptyManga} follows={follows} />);
    });

    expectTitleExists(emptyManga);
    expectMangaInfoExists(emptyManga);
    expectSourcesExist(emptyManga);
    expectAdminControls(false);
    expectAuthenticatedFeatures(false);
  });
});
