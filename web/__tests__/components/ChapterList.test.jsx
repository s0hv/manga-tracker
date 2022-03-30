import React from 'react';
import fetchMock from 'fetch-mock';

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockNotistackHooks } from '../utils';
import ChapterList from '../../src/components/ChapterList';

mockNotistackHooks();

describe('Chapter list should allow editing', () => {
  const testChapter = {
    chapterId: 1,
    title: 'Test chapter',
    chapterNumber: 1,
    releaseDate: new Date(1593964800000),
    group: 'Test group',
    serviceId: 1,
    chapterUrl: 'https://mangaplus.shueisha.co.jp/titles/1007322',
  };

  const serviceUrlFormats = {
    [testChapter.serviceId]: '{}',
  };

  const mangaId = 1;

  const mockChapters = (chapters) => {
    const chaptersMock = jest.fn();
    chaptersMock.mockImplementation(
      () => Promise.resolve({ count: chapters?.length, chapters: chapters })
    );
    fetchMock.get(
      `path:/api/manga/${mangaId}/chapters`,
      chaptersMock,
      { overwriteRoutes: true }
    );
    return chaptersMock;
  };

  it('Should post correctly', async () => {
    const postMock = jest.fn();
    postMock.mockImplementation(() => Promise.resolve({}));
    fetchMock.post('path:/api/chapter/1', postMock);
    const chapters = [testChapter];
    mockChapters(chapters);

    const addedCharacters = 'test';
    const updatedChapter = {
      title: chapters[0].title + addedCharacters,
    };

    await act(async () => {
      render(
        <ChapterList
          chapters={chapters}
          mangaId={mangaId}
          editable
        />
      );
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit row/i }));

    await user.type(
      screen.getByLabelText(/title input/i),
      addedCharacters
    );

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /save row/i }));
    });

    expect(postMock).toHaveBeenCalledTimes(1);
    // Make sure body contains all edited values
    const callArgs = postMock.mock.calls[0];
    expect(JSON.parse(callArgs[1].body)).toMatchObject(updatedChapter);
  });

  it('Should delete correctly', async () => {
    const deleteMock = jest.fn();
    deleteMock.mockImplementation(() => Promise.resolve({}));
    fetchMock.delete(`path:/api/chapter/${testChapter.chapterId}`, deleteMock);

    const chapters = [testChapter];
    mockChapters(chapters);

    await act(async () => {
      render(<ChapterList
        chapters={chapters}
        editable
        mangaId={mangaId}
        serviceUrlFormats={serviceUrlFormats}
      />);
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit row/i }));

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /delete row/i }));
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /confirm delete row/i }));
    });

    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it('Should update data when chapters prop changes', async () => {
    mockChapters([]);

    let rerender;
    await act(async () => {
      const retVal = render(
        <ChapterList
          chapters={[]}
          mangaId={mangaId}
          serviceUrlFormats={serviceUrlFormats}
        />
      );
      rerender = retVal.rerender;
    });
    expect(screen.queryByRole('cell')).not.toBeInTheDocument();

    rerender(
      <ChapterList
        chapters={[testChapter]}
        mangaId={mangaId}
        serviceUrlFormats={serviceUrlFormats}
      />
    );

    expect(screen.queryByRole('cell', { name: testChapter.title })).toBeInTheDocument();
  });

  it('Should try to fetch chapters', async () => {
    const chapters = [testChapter];
    const chaptersMock = mockChapters(chapters);

    await act(async () => {
      render(
        <ChapterList
          chapters={[]}
          mangaId={mangaId}
          serviceUrlFormats={serviceUrlFormats}
        />
      );
    });

    expect(chaptersMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('cell', { name: chapters[0].title })).toBeInTheDocument();
  });
});
