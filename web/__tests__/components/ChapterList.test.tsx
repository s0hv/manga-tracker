import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { describe, expect, it, MockInstance, vi } from 'vitest';

import { mockServicesEndpoint, TestRoot } from '@/tests/utils';
import ChapterList, { type MangaChapterWithUrl } from '@/components/ChapterList';
import { testServices } from '@/tests/constants';


describe('Chapter list should allow editing', () => {
  const testChapter: MangaChapterWithUrl = {
    chapterId: 1,
    title: 'Test chapter',
    chapterNumber: 1,
    releaseDate: new Date(1593964800000),
    group: 'Test group',
    serviceId: 1,
    url: 'https://mangaplus.shueisha.co.jp/titles/1007322',
    chapterDecimal: null,
    chapterIdentifier: 'test-chapter',
  };

  const testService = testServices[0];

  const serviceMangaData = {
    [testChapter.serviceId]: { urlFormat: '{}', titleId: 'test' },
  };

  const mangaId = 1;

  const mockChapters = (chapters: MangaChapterWithUrl[]) => {
    const chaptersMock = vi.fn();
    chaptersMock.mockImplementation(
      () => Promise.resolve({ count: chapters?.length, chapters: chapters })
    );

    fetchMock.get(
      `path:/api/manga/${mangaId}/chapters`,
      chaptersMock,
      { overwriteRoutes: true }
    );

    const servicesMock = mockServicesEndpoint();

    return [chaptersMock, servicesMock];
  };

  const waitForChaptersLoaded = async (chaptersMock: MockInstance) => {
    await waitFor(() => expect(chaptersMock).toHaveBeenCalledTimes(1));
  };

  it('Should post correctly', async () => {
    const postMock = vi.fn();
    postMock.mockImplementation(() => Promise.resolve({}));
    fetchMock.post('path:/api/chapter/1', postMock);
    const chapters = [testChapter];
    const [chaptersMock] = mockChapters(chapters);

    const addedCharacters = 'test';
    const updatedChapter = {
      title: chapters[0].title + addedCharacters,
    };

    await act(async () => {
      render(
        <TestRoot>
          <ChapterList
            mangaId={mangaId}
            editable
          />
        </TestRoot>
      );
    });

    await waitForChaptersLoaded(chaptersMock);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /edit row/i }));

    await user.type(
      await screen.findByLabelText(/title input/i),
      addedCharacters
    );

    await user.click(screen.getByRole('button', { name: /save row/i }));

    expect(postMock).toHaveBeenCalledTimes(1);
    // Make sure body contains all edited values
    const callArgs = postMock.mock.calls[0];
    expect(JSON.parse(callArgs[1].body)).toMatchObject(updatedChapter);
  });

  it('Should delete correctly', async () => {
    const deleteMock = vi.fn();
    deleteMock.mockImplementation(() => Promise.resolve({}));
    fetchMock.delete(`path:/api/chapter/${testChapter.chapterId}`, deleteMock);

    const chapters = [testChapter];
    const [chaptersMock] = mockChapters(chapters);

    await act(async () => {
      render(
        <TestRoot>
          <ChapterList
            editable
            mangaId={mangaId}
            serviceMangaData={serviceMangaData}
          />
        </TestRoot>
      );
    });

    await waitForChaptersLoaded(chaptersMock);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit row/i }));

    await user.click(screen.getByRole('button', { name: /delete row/i }));

    await user.click(screen.getByRole('button', { name: /confirm delete row/i }));

    expect(deleteMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(chaptersMock).toHaveBeenCalledTimes(2));
  });

  it('Should try to fetch chapters', async () => {
    const chapters = [testChapter];
    const [chaptersMock, servicesMock] = mockChapters(chapters);

    await act(async () => {
      render(
        <TestRoot>
          <ChapterList
            mangaId={mangaId}
            serviceMangaData={serviceMangaData}
          />
        </TestRoot>
      );
    });

    await waitFor(() => expect(chaptersMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(servicesMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('cell', { name: chapters[0].title })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: testService.name })).toBeInTheDocument();
  });
});
