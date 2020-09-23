import React from 'react';
import { create } from 'react-test-renderer';
import fetchMock from 'fetch-mock';
import { createMount } from '@material-ui/core/test-utils';
import { act } from '@testing-library/react';

import { editInput, mockUTCDates } from '../utils';
import ChapterList from '../../src/components/ChapterList';

describe('Chapter list should render correctly', () => {
  mockUTCDates();
  const chapters = [
    {
      title: 'Z=157: Same Time, Same Place',
      chapter_number: 157,
      release_date: new Date(1593964800000),
      group: 'Shueisha',
      service_id: 1,
      chapter_url: 'https://mangaplus.shueisha.co.jp/titles/1007322',
    },
    {
      title: 'Z=156: Two Scientists',
      chapter_number: 156,
      release_date: new Date(null),
      group: 'MangaPlus',
      service_id: 2,
      chapter_url: 'https://mangadex.org/title/938629',
    },
    {
      title: 'Z=156: Two Scientists',
      chapter_number: 156,
      release_date: new Date(1593187200000),
      group: 'Shueisha',
      service_id: 1,
      chapter_url: 'https://mangaplus.shueisha.co.jp/titles/1007024',
    },
  ];

  it('with chapters', () => {
    const tree = create(
      <ChapterList chapters={chapters} />
    );

    expect(tree).toMatchSnapshot();
  });

  it('without chapters', () => {
    const tree = create(
      <ChapterList chapters={[]} />
    );

    expect(tree).toMatchSnapshot();
  });

  it('with chapters and edit', () => {
    const tree = create(
      <ChapterList chapters={chapters} editable />
    );

    expect(tree).toMatchSnapshot();
  });
});

describe('Chapter list should allow editing', () => {
  const testChapter = {
    chapter_id: 1,
    title: 'Test',
    chapter_number: 1,
    release_date: new Date(1593964800000),
    group: 'Test group',
    service_id: 1,
    chapter_url: 'https://mangaplus.shueisha.co.jp/titles/1007322',
  };

  it('Should post correctly', async () => {
    const postMock = jest.fn();
    postMock.mockImplementation(() => Promise.resolve({}));
    fetchMock.post('path:/api/chapter/1', postMock);

    const updatedChapter = {
      title: 'Test edit',
      chapter_number: 5,
      group: 'Test group edit',
    };

    const wrapper = createMount()(<ChapterList chapters={[testChapter]} editable />);
    wrapper.find('button[name="edit"]').simulate('click');

    await editInput(
      wrapper.find('input').find({ defaultValue: testChapter.title }),
      updatedChapter.title
    );
    await editInput(
      wrapper.find('input').find({ defaultValue: testChapter.chapter_number }),
      updatedChapter.chapter_number
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
    fetchMock.delete('path:/api/chapter/1', deleteMock);

    const wrapper = createMount()(<ChapterList chapters={[testChapter]} editable />);
    wrapper.find('button[name="edit"]').simulate('click');

    await act(async () => {
      wrapper.find('button[name="delete"]').simulate('click');
    });

    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it('Should update data when chapters prop changes', () => {
    const wrapper = createMount()(<ChapterList chapters={[]} />);
    expect(wrapper.exists('td')).toBeFalse();

    wrapper.setProps({ chapters: [testChapter]});
    wrapper.update();

    expect(wrapper.exists('td')).toBeTrue();
  });
});
