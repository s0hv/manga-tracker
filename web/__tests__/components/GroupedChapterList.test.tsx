import React from 'react';
import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCoverUrl } from '@/tests/utils';
import {
  type ChapterComponentProps,
  type GroupComponentProps,
  ChapterGroupWithCover,
  ChapterWithLink,
  GroupedChapterList,
  useGroupedChapters,
} from '@/components/chapter/GroupedChapterList';
import type { ChapterRelease } from '@/types/api/chapter';
import type { ServiceForApi } from '@/types/api/services';
import { formatChapterTitle, formatChapterUrl } from '@/webUtils/formatting';


import { testChapterUrlFormat } from '../constants';
import { generateNSchemas, LatestChapter, setupFaker } from '../schemas';


describe('ChapterGroupWithCover', () => {
  const mangaToCover = {
    1: 'http://localhost/test1',
    2: 'http://localhost/test2',
  };

  it('should render correctly', async () => {
    const groupChildren = 'group children for test';
    const groupString = 'Test group';
    const mangaId = 1;
    render(
      <ChapterGroupWithCover
        mangaId={mangaId}
        group={mangaId}
        groupString={groupString}
        groupItems={[]}
        mangaToCover={mangaToCover}
      >
        {groupChildren}
      </ChapterGroupWithCover>
    );

    expect(screen.getByText(groupChildren)).toBeInTheDocument();
    const cover = screen.getByRole('img', { name: groupString });
    expect(cover).toBeInTheDocument();
    expect(cover).toHaveAttribute('src', getCoverUrl(mangaToCover[mangaId]));

    expect(screen.getByRole('heading', { name: groupString })).toBeInTheDocument();
    expect(screen.getByText('0 chapters')).toBeInTheDocument();
  });
});

describe('ChapterWithLink', () => {
  const services: Record<number, ServiceForApi> = {
    1: {
      name: 'Test service',
      chapterUrlFormat: testChapterUrlFormat,
      serviceId: 1,
      disabled: false,
      url: '',
      mangaUrlFormat: '',
    },
  };

  it('should render correctly', async () => {
    const serviceId = 1;
    const service = services[serviceId];
    const chapter: ChapterRelease = {
      serviceId,
      chapterIdentifier: 'chapterIdentifierTest',
      title: 'Test title',
      chapterNumber: 10,

      chapterDecimal: null,
      chapterId: 0,
      cover: '',
      group: '',
      manga: '',
      mangaId: 0,
      releaseDate: new Date(),
      titleId: '',
    };

    render(
      <ChapterWithLink chapter={chapter} services={services} />
    );

    // Should be enclosed in a link
    expect(screen.getByRole('link')).toBeInTheDocument();

    // Chapter title should be properly formatted
    expect(screen.getByText(formatChapterTitle(chapter))).toBeInTheDocument();

    // Link button should exist
    const linkBtn = screen.getByRole('button', { name: /Open chapter in new tab/i });
    expect(linkBtn).toBeInTheDocument();
    expect(linkBtn.closest('a'))
      .toHaveAttribute('href', formatChapterUrl(service.chapterUrlFormat, chapter.chapterIdentifier));
  });
});


describe('GroupedChapterList', () => {
  beforeEach(() => {
    setupFaker();
  });

  const groupA = 1;
  const groupB = 2;
  const groupC = 3;

  const generateChaptersWithMangaId = (mangaId: number, count: number) =>
    generateNSchemas<ChapterRelease>(LatestChapter, count)
      .map(chapter => {
        chapter.mangaId = mangaId;
        return chapter;
      });

  it('should render correctly', async () => {
    const nGroups = 3;
    const groupToString = vi.fn().mockImplementation(group => group);

    const GroupComponent = ({ children }: GroupComponentProps) => <div>{children}</div>;
    const GroupComponentMock = vi.fn().mockImplementation(GroupComponent);

    const ChapterComponent = ({ chapter: { title }}: ChapterComponentProps) => (
      <h5 data-testid='test-id'>
        {title}
      </h5>
    );
    const ChapterComponentMock = vi.fn().mockImplementation(ChapterComponent);

    const chaptersA1 = generateChaptersWithMangaId(groupA, 5);
    const chaptersB = generateChaptersWithMangaId(groupB, 2);
    const chaptersC1 = generateChaptersWithMangaId(groupC, 1);
    const chaptersA2 = generateChaptersWithMangaId(groupA, 1);
    const chaptersC2 = generateChaptersWithMangaId(groupC, 1);

    const chapters: ChapterRelease[] = [
      ...chaptersA1,
      ...chaptersB,
      ...chaptersC1,
      ...chaptersA2,
      ...chaptersC2,
    ];

    const groupedChapters = renderHook(() => useGroupedChapters(chapters)).result.current;

    render(
      <GroupedChapterList
        groupedChapters={groupedChapters}
        groupToString={groupToString}
        GroupComponent={GroupComponentMock}
        ChapterComponent={ChapterComponentMock}
      />
    );

    // Ensure that the correct number of groups rendered
    expect(GroupComponentMock).toHaveBeenCalledTimes(nGroups);
    // Truncated chapter count
    expect(ChapterComponentMock).toHaveBeenCalledTimes(7);

    // Check that showing more chapters works
    const user = userEvent.setup();

    const showFewerRegex = /^show fewer$/i;

    expect(screen.queryByRole('button', { name: showFewerRegex })).not.toBeInTheDocument();

    const showMoreBtn = screen.getByRole('button', { name: /^show all 6 chapters$/i });
    await user.click(showMoreBtn);

    expect(screen.getByRole('button', { name: showFewerRegex })).toBeInTheDocument();

    expect(screen.getAllByTestId('test-id')).toHaveLength(chapters.length);

    // Static element checks
    expect(screen.getByRole('button', { name: 'Load 15 older chapters' })).toBeInTheDocument();
    expect(screen.getByText('Chapters from series already listed are added to their card above.')).toBeInTheDocument();
  });
});
