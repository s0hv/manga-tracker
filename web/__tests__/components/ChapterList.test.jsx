import React from 'react';
import fetchMock from 'fetch-mock';
import { createMount, createShallow } from '@material-ui/core/test-utils';
import { act } from '@testing-library/react';

import { editInput, mockUTCDates, mockNotistackHooks } from '../utils';
import ChapterList from '../../src/components/ChapterList';

mockNotistackHooks();

describe('Chapter list should render correctly', () => {
  mockUTCDates();
  const chapters = [
    {
      title: 'Z=157: Same Time, Same Place',
      chapterNumber: 157,
      releaseDate: new Date(1593964800000),
      group: 'Shueisha',
      serviceId: 1,
      chapterUrl: 'https://mangaplus.shueisha.co.jp/titles/1007322',
    },
    {
      title: 'Z=156: Two Scientists',
      chapterNumber: 156,
      releaseDate: new Date(null),
      group: 'MangaPlus',
      serviceId: 2,
      chapterUrl: 'https://mangadex.org/title/938629',
    },
    {
      title: 'Z=156: Two Scientists',
      chapterNumber: 156,
      releaseDate: new Date(1593187200000),
      group: 'Shueisha',
      serviceId: 1,
      chapterUrl: 'https://mangaplus.shueisha.co.jp/titles/1007024',
    },
  ];

  it('with chapters', () => {
    const wrapper = createShallow()(
      <ChapterList chapters={chapters} />
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('without chapters', () => {
    const wrapper = createShallow()(
      <ChapterList chapters={[]} />
    );

    expect(wrapper).toMatchSnapshot();

    expect(() => createShallow()(
      <ChapterList chapters={null} />
    )).not.toThrow();
  });

  it('with chapters and edit', () => {
    const wrapper = createShallow()(
      <ChapterList chapters={chapters} editable />
    );

    expect(wrapper).toMatchSnapshot();
  });
});

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

    const updatedChapter = {
      title: 'Test edit',
      chapterNumber: 5,
      group: 'Test group edit',
    };

    const wrapper = createMount()(<ChapterList chapters={chapters} editable mangaId={mangaId} />);
    wrapper.find('button[name="edit"]').simulate('click');

    await editInput(
      wrapper.find('input').find({ defaultValue: testChapter.title }),
      updatedChapter.title
    );
    await editInput(
      wrapper.find('input').find({ defaultValue: testChapter.chapterNumber }),
      updatedChapter.chapterNumber
    );
    await editInput(
      wrapper.find('input').find({ defaultValue: testChapter.group }),
      updatedChapter.group
    );

    await act(async () => {
      wrapper.find('button[name="save"]').simulate('click');
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

    const wrapper = createMount()(<ChapterList
      chapters={chapters}
      editable
      mangaId={mangaId}
      serviceUrlFormats={serviceUrlFormats}
    />);
    wrapper.find('button[name="edit"]').simulate('click');

    await act(async () => {
      wrapper.find('button[name="delete"]').simulate('click');
    });
    wrapper.update();
    await act(async () => {
      wrapper.find('button[aria-label="Confirm delete row"]').simulate('click');
    });

    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it('Should update data when chapters prop changes', async () => {
    mockChapters([]);

    let wrapper = null;
    await act(async () => {
      wrapper = createMount()(
        <ChapterList
          chapters={[]}
          mangaId={mangaId}
          serviceUrlFormats={serviceUrlFormats}
        />
      );
    });
    expect(wrapper.exists('td')).toBeFalse();

    wrapper.setProps({ chapters: [testChapter]});
    wrapper.update();

    expect(wrapper.exists('td')).toBeTrue();
  });

  it('Should try to fetch chapters', async () => {
    const chapters = [testChapter];
    const chaptersMock = mockChapters(chapters);

    let wrapper = null;
    await act(async () => {
      wrapper = createMount()(
        <ChapterList
          chapters={[]}
          mangaId={mangaId}
          serviceUrlFormats={serviceUrlFormats}
        />
      );
    });

    expect(wrapper).not.toBeNull();
    expect(chaptersMock).toHaveBeenCalledTimes(1);

    wrapper.update();
    expect(wrapper.exists('td')).toBeTrue();
  });
});
