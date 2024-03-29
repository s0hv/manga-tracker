import React from 'react';
import fetchMock from 'fetch-mock';
import { type Mock, vi } from 'vitest';

import { act, render, screen } from '@testing-library/react';
import {
  generateNSchemas,
  LatestChapter,
  Service,
  setupFaker,
} from '../schemas';

import App from '@/views/App';
import { normalUser } from '../utils';
import type { ServiceForApi } from '@/types/api/services';
import type { ChapterRelease } from '@/types/api/chapter';
import { UserProvider } from '@/webUtils/useUser';

setupFaker();

describe('Chapter list should allow editing', () => {
  const mockChapters = (n = 10): [Mock, Mock, ChapterRelease[]] => {
    fetchMock.reset();
    const chaptersMock = vi.fn();
    const chapters = generateNSchemas<ChapterRelease>(LatestChapter, n);
    const serviceIds = new Set<number>(chapters.map(c => c.serviceId));
    const services = generateNSchemas<ServiceForApi>(Service, serviceIds.size);

    let idx = 0;
    for (const serviceId of serviceIds) {
      services[idx].serviceId = serviceId;
      idx++;
    }

    chaptersMock.mockImplementation(
      () => Promise.resolve({ data: chapters })
    );
    fetchMock.get(
      `glob:/api/chapter/latest?*`,
      chaptersMock
    );

    const servicesMock = vi.fn();
    servicesMock.mockImplementation(() => Promise.resolve({ data: services }));

    fetchMock.get(
      `path:/api/services`,
      servicesMock
    );

    return [chaptersMock, servicesMock, chapters];
  };

  it('Renders correctly', async () => {
    const [chapterMock, serviceMock, chapters] = mockChapters();
    await act(async () => {
      render(<App />);
    });

    expect(chapterMock).toHaveBeenCalledOnce();
    expect(serviceMock).toHaveBeenCalledOnce();

    expect(fetchMock.called('/api/chapter/latest', { query: { useFollows: 'false' }})).toBeTrue();

    expect(screen.queryByRole('heading', { name: 'Recent Releases' })).toBeInTheDocument();

    // Testing that one chapter is visible is enough.
    // Chapter list component has its own tests.
    const chapter = chapters[0];

    expect(screen.queryByRole('heading', { name: chapter.manga })).toBeInTheDocument();

    const cover = screen.queryByRole('img', { name: chapter.manga });
    expect(cover).toBeInTheDocument();
    expect(cover).toHaveProperty('src', `${chapter.cover}.256.jpg`);
  });

  it('Renders correctly with user', async () => {
    mockChapters();
    await act(async () => {
      render(<UserProvider value={normalUser}><App /></UserProvider>);
    });

    expect(fetchMock.called('/api/chapter/latest', { query: { useFollows: 'true' }})).toBeTrue();
  });
});
