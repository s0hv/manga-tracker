import React from 'react';
import fetchMock from 'fetch-mock';

import { act, render, screen } from '@testing-library/react';
import {
  generateNSchemas,
  LatestChapter,
  Service,
  setupFaker,
} from '../schemas';

import App from '@/views/App';
import { normalUser } from '../utils';
import { ServiceForApi } from '@/types/api/services';
import { ChapterRelease } from '@/types/api/chapter';

setupFaker();

describe('Chapter list should allow editing', () => {
  const mockChapters = (n = 10): [jest.Mock, jest.Mock, ChapterRelease[]] => {
    const chaptersMock = jest.fn();
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

    const servicesMock = jest.fn();
    servicesMock.mockImplementation(() => Promise.resolve({ data: services }));

    fetchMock.get(
      `path:/api/services`,
      servicesMock
    );

    return [chaptersMock, servicesMock, chapters];
  };


  it('Render correctly', async () => {
    const [chapterMock, serviceMock, chapters] = mockChapters();
    await act(async () => {
      render(<App user={normalUser} />);
    });

    expect(chapterMock).toHaveBeenCalledOnce();
    expect(serviceMock).toHaveBeenCalledOnce();

    expect(screen.queryByRole('heading', { name: 'Recent Releases' })).toBeInTheDocument();

    // Testing that one chapter is visible is enough.
    // Chapter list component has its own tests.
    const chapter = chapters[0];

    expect(screen.queryByRole('heading', { name: chapter.manga })).toBeInTheDocument();
  });
});
