import React from 'react';
import {
  type ByRoleMatcher,
  type ByRoleOptions,
  act,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock, {
  type MockOptions,
  type MockOptionsMethodDelete,
  type MockOptionsMethodPut,
} from 'fetch-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  adminUser,
  mockNotistackHooks,
  mockUTCDates,
  normalUser,
  withUser,
} from '../utils';
import Manga from '@/components/Manga';

import { emptyFullManga as emptyManga, fullManga as manga } from '../constants';

vi.mock('es-toolkit', () => ({
  throttle: (_: any) => _,
}));

describe('Manga page should render correctly', async () => {
  mockUTCDates();
  await mockNotistackHooks();

  beforeEach(() => {
    fetchMock.reset();
    fetchMock.get('express:/api/manga/:mangaId/chapters', { chapters: []});
    fetchMock.get('express:/api/chapter/releases/:mangaId', []);
  });

  const follows = [1];

  /**
   * Based on a condition checks whether an element should or
   * should not exist in the document
   * @param {boolean} shouldExist Condition, which if true, makes sure that the element exists
   * @param {import('@testing-library/react').ByRoleMatcher} role The role of the element
   * @param {import('@testing-library/react').ByRoleOptions} options
   */
  const conditionalInDocument = (shouldExist: boolean, role: ByRoleMatcher, options: ByRoleOptions) => {
    if (shouldExist) {
      expect(screen.getByRole(role, options)).toBeInTheDocument();
    } else {
      expect(screen.queryByRole(role, options)).not.toBeInTheDocument();
    }
  };

  const expectTitleExists = (m: any) => {
    expect(
      screen.getByRole('heading', { name: m.manga.title })
    ).toBeInTheDocument();
  };

  const expectMangaInfoExists = (m: any) => {
    // With cover mal link and the cover should exist. Otherwise they should be hidden
    if (m.manga.cover) {
      const malLink = screen.getByRole('link', { name: /myanimelist page of the manga/i });
      expect(malLink).toBeInTheDocument();
      expect(malLink).toHaveAttribute('href', m.manga.mal);

      const coverImage = screen.getByRole('img', { name: m.manga.title });
      expect(coverImage).toBeInTheDocument();
      expect(coverImage.getAttribute('src')).toStartWith('/_next/image?url=' + encodeURIComponent(`${m.manga.cover}.256.jpg`));
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

  const expectSourcesExist = (_: any) => {
    expect(screen.getByRole('list', { name: 'manga sources' })).toBeInTheDocument();
  };

  const expectAdminControls = (isAdmin: boolean) => {
    conditionalInDocument(isAdmin, 'button', { name: /admin page/i });

    conditionalInDocument(isAdmin, 'button', { name: /edit chapters/i });
  };

  const expectAuthenticatedFeatures = (isAuthenticated: boolean) => {
    conditionalInDocument(isAuthenticated, 'button', { name: /follow all releases/i });
  };

  it('should render correctly', async () => {
    await act(async () => {
      render(<Manga mangaData={manga} userFollows={follows} />);
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
        <Manga mangaData={manga} userFollows={follows} />
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
        <Manga mangaData={manga} userFollows={follows} />
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
      render(<Manga mangaData={emptyManga} />);
    });

    expectTitleExists(emptyManga);
    expectMangaInfoExists(emptyManga);
    expectSourcesExist(emptyManga);
    expectAdminControls(false);
    expectAuthenticatedFeatures(false);
  });

  const followsUrl = 'path:/api/user/follows';
  const mockFollowUnfollow = (options: MockOptions) => {
    fetchMock.put(followsUrl, 200, options as MockOptionsMethodPut);
    fetchMock.delete(followsUrl, 200, options as MockOptionsMethodDelete);
  };

  const followCalls = (options: MockOptionsMethodPut = {}) => {
    options.method = 'PUT';
    return fetchMock.calls(followsUrl, options);
  };

  const unfollowCalls = (options: MockOptionsMethodDelete = {}) => {
    options.method = 'DELETE';
    return fetchMock.calls(followsUrl, options);
  };

  it('should call follow and unfollow on click for all services', async () => {
    await act(async () => {
      render(await withUser(normalUser, <Manga mangaData={manga} userFollows={follows} />));
    });

    mockFollowUnfollow({ query: { mangaId: manga.manga.mangaId }});

    const followBtn = screen.getByRole('button', { name: 'follow all releases' });
    const user = userEvent.setup();

    await user.click(followBtn);
    expect(followCalls()).toBeArrayOfSize(1);
    expect(unfollowCalls()).toBeArrayOfSize(0);

    expect(followBtn.textContent).toBe('Unfollow');
    await user.click(followBtn);

    expect(followCalls()).toBeArrayOfSize(1);
    expect(unfollowCalls()).toBeArrayOfSize(1);
  });

  it('should call follow and unfollow on click for a specific service', async () => {
    await act(async () => {
      render(await withUser(normalUser, <Manga mangaData={manga} userFollows={[manga.services[0].serviceId]} />));
    });

    mockFollowUnfollow({ query: { mangaId: manga.manga.mangaId, serviceId: manga.services[0].serviceId }});
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'open follows' }));

    const followBtn = screen.getByRole('button', { name: `unfollow ${manga.services[0].name}` });

    await user.click(followBtn);
    expect(followCalls()).toBeArrayOfSize(0);
    expect(unfollowCalls()).toBeArrayOfSize(1);

    expect(followBtn.textContent).toBe('Follow');
    await user.click(followBtn);

    expect(followCalls()).toBeArrayOfSize(1);
    expect(unfollowCalls()).toBeArrayOfSize(1);
  });
});
