import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type ChapterComponentProps,
  ChapterGroupWithCover,
  ChapterWithLink,
  type GroupComponentProps,
  GroupedChapterList,
} from '@/components/GroupedChapterList';
import { testChapterUrlFormat } from '../constants';
import { formatChapterTitle, formatChapterUrl } from '@/webUtils/formatting';
import { generateNSchemas, LatestChapter, setupFaker } from '../schemas';
import type { ChapterRelease } from '@/types/api/chapter';
import type { ServiceForApi } from '@/types/api/services';


describe('ChapterGroupWithCover', () => {
  const mangaToCover = {
    1: 'test1',
    2: 'test2',
  };

  it('should render correctly', async () => {
    const Component = ChapterGroupWithCover(mangaToCover);
    const groupChildren = 'group children for test';
    const groupString = 'group name';
    const mangaId = 1;
    render(
      <Component
        mangaId={mangaId}
        group={mangaId}
        groupString={groupString}
      >
        {groupChildren}
      </Component>
    );

    expect(screen.getByText(groupChildren)).toBeInTheDocument();
    const cover = screen.getByRole('img', { name: groupString });
    expect(cover).toBeInTheDocument();
    expect(cover).toHaveAttribute('src', `${mangaToCover[mangaId]}.256.jpg`);

    expect(screen.getByRole('heading', { name: groupString }));
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
    const Component = ChapterWithLink(services);
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
      <Component chapter={chapter} />
    );

    // Should be enclosed in a li tag
    expect(screen.getByRole('listitem')).toBeInTheDocument();

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

  const generateChaptersWithMangaId = (mangaId: number, count: number) => generateNSchemas<ChapterRelease>(LatestChapter, count)
    .map(chapter => {
      chapter.mangaId = mangaId;
      return chapter;
    });

  it('should render correctly', async () => {
    const nGroups = 5;
    const groupToString = vi.fn().mockImplementation(group => group);

    const GroupComponent = ({ children }: GroupComponentProps) => <div>{children}</div>;
    const GroupComponentMock = vi.fn().mockImplementation(GroupComponent);

    const ChapterComponent = ({ chapter: { title }}: ChapterComponentProps) => <h5>{title}</h5>;
    const ChapterComponentMock = vi.fn().mockImplementation(ChapterComponent);

    const chaptersA1 = generateChaptersWithMangaId(groupA, 2);
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

    render(<GroupedChapterList
      chapters={chapters}
      groupKey='mangaId'
      groupToString={groupToString}
      GroupComponent={GroupComponentMock}
      ChapterComponent={ChapterComponentMock}
    />);

    // This component does not really render anything of its own so these tests
    // should be fine as they assert that the given components are rendered
    // the correct amount of times
    expect(GroupComponentMock).toHaveBeenCalledTimes(nGroups);
    expect(ChapterComponentMock).toHaveBeenCalledTimes(chapters.length);
  });
});
