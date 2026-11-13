import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, MockInstance } from 'vitest';

import {
  expectErrorSnackbar,
  expectSuccessSnackbar,
  mockNotistackHooks,
  mockRequestJson,
  mockRequestWithBody,
  setupMockServer,
  TestRoot,
} from '@/tests/utils';
import ChapterList, { type MangaChapterWithUrl } from '@/components/ChapterList';
import { testServices } from '@/tests/constants';

const server = setupMockServer();

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
  const chapterUrl = `/api/chapter/${testChapter.chapterId}`;

  const mockChapters = (chapters: MangaChapterWithUrl[]) => {
    const chaptersMock = mockRequestJson(
      server,
      `/api/manga/${mangaId}/chapters`,
      {
        count: chapters.length,
        chapters: chapters.map(chapter => ({ ...chapter, releaseDate: chapter.releaseDate.toISOString() })),
      }
    );
    const servicesMock = mockRequestJson(server, '/api/services', testServices);

    return [chaptersMock, servicesMock];
  };

  const waitForChaptersLoaded = async (chaptersMock: MockInstance) => {
    await waitFor(() => expect(chaptersMock).toHaveBeenCalledTimes(1));
  };

  const renderAndStartEditing = async () => {
    const [chaptersMock] = mockChapters([testChapter]);

    act(() => {
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

    return user;
  };

  it('Should post correctly', async () => {
    const postMock = mockRequestWithBody(server, chapterUrl, {});
    const addedCharacters = 'test';

    const user = await renderAndStartEditing();

    await user.type(
      await screen.findByLabelText(/title input/i),
      addedCharacters
    );

    await user.click(screen.getByRole('button', { name: /save row/i }));

    await waitFor(() => expect(postMock).toHaveBeenCalledOnce());
    // Make sure body contains all edited values
    expect(postMock).toHaveBeenCalledWith(expect.objectContaining({
      title: testChapter.title + addedCharacters,
    }));
  });

  it.each([
    ['12.5', { chapterNumber: 12, chapterDecimal: 5 }],
    ['12', { chapterNumber: 12, chapterDecimal: null }],
  ])('Should post chapter number %s correctly', async (input, expectedBody) => {
    await mockNotistackHooks();
    const postMock = mockRequestWithBody(server, chapterUrl, { message: 'Updated' });

    const user = await renderAndStartEditing();

    const chapterInput = screen.getByRole('textbox', { name: /chapter number/i });
    expect(chapterInput).toHaveValue(testChapter.chapterNumber.toString());

    await user.clear(chapterInput);
    await user.type(chapterInput, input);
    await user.click(screen.getByRole('button', { name: /save row/i }));

    await waitFor(() => expectSuccessSnackbar());
    expect(postMock).toHaveBeenCalledExactlyOnceWith(expectedBody);
    expect(screen.queryByRole('textbox', { name: /chapter number/i })).not.toBeInTheDocument();
  });

  it('Should keep the row in edit mode when saving fails', async () => {
    await mockNotistackHooks();
    mockRequestWithBody(
      server,
      chapterUrl,
      { error: { 'body.chapterNumber': ['Invalid chapter number']}},
      { status: 400 }
    );

    const user = await renderAndStartEditing();

    const chapterInput = screen.getByRole('textbox', { name: /chapter number/i });
    await user.clear(chapterInput);
    await user.type(chapterInput, '2');
    await user.click(screen.getByRole('button', { name: /save row/i }));

    await waitFor(() => expectErrorSnackbar('body.chapterNumber: Invalid chapter number'));
    expect(screen.getByRole('textbox', { name: /chapter number/i })).toBeInTheDocument();
  });

  it('Should delete correctly', async () => {
    const deleteMock = mockRequestWithBody(server, chapterUrl, {}, { method: 'delete' });

    const [chaptersMock] = mockChapters([testChapter]);

    // Async required, or test will fail
    // eslint-disable-next-line @typescript-eslint/require-await
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

    await waitFor(() => expect(deleteMock).toHaveBeenCalledOnce());
    await waitFor(() => expect(chaptersMock).toHaveBeenCalledTimes(2));
  });

  it('Should try to fetch chapters', async () => {
    const [chaptersMock, servicesMock] = mockChapters([testChapter]);

    act(() => {
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
    expect(await screen.findByRole('cell', { name: testChapter.title })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: testService.name })).toBeInTheDocument();
  });
});
