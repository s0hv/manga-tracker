import React from 'react';
import { create } from 'react-test-renderer';
import { mockUTCDates } from '../utils';
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
