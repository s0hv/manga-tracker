import { describe, expect, it } from 'vitest';

import {
  formatChapterTitle,
  formatChapterUrl,
} from '@/webUtils/formatting';

describe('formatChapterTitle', () => {
  it('Should format correctly without decimal', () => {
    const title = formatChapterTitle({ title: 'test', chapterNumber: 10 });
    expect(title).toMatchInlineSnapshot(`"Chapter 10 – test"`);
  });

  it('Should format correctly with decimal', () => {
    const title = formatChapterTitle({ title: 'test', chapterNumber: 10, chapterDecimal: 5 });
    expect(title).toMatchInlineSnapshot(`"Chapter 10.5 – test"`);
  });

  it('Should not include title if it is just the chapter number with decimal', () => {
    const title = formatChapterTitle({ title: 'Chapter 10.5', chapterNumber: 10, chapterDecimal: 5 });
    expect(title).toMatchInlineSnapshot(`"Chapter 10.5"`);
  });

  it('Should not include title if it is just the chapter number without decimal', () => {
    const title = formatChapterTitle({ title: 'chapter 10', chapterNumber: 10 });
    expect(title).toMatchInlineSnapshot(`"Chapter 10"`);
  });

  it('Should return just chapter number when title is undefined', () => {
    const title = formatChapterTitle({ title: undefined, chapterNumber: 10 });
    expect(title).toMatchInlineSnapshot(`"Chapter 10"`);
  });

  it('Should return undefined when all inputs undefined', () => {
    const title = formatChapterTitle({});
    expect(title).toMatchInlineSnapshot(`"Chapter undefined"`);
  });

  it('Should throw when no inputs given', () => {
    expect(formatChapterTitle).toThrow(TypeError);
  });
});

describe('formatChapterUrl', () => {
  it('Should return undefined if chapterUrlFormat is falsy', () => {
    expect(formatChapterUrl('', 'abc', 'id')).toBeUndefined();
    expect(formatChapterUrl(undefined, 'abc', 'id')).toBeUndefined();
    expect(formatChapterUrl(null, 'abc', 'id')).toBeUndefined();
  });

  it('Should replace {} with second argument', () => {
    expect(formatChapterUrl('{}', 'abc', 'testId')).toBe('abc');
    expect(formatChapterUrl('abc/{}/x', 'defg', 'testId')).toMatchInlineSnapshot(`"abc/defg/x"`);
    expect(formatChapterUrl('{title_id}/{}/x', 'defg', 'testId')).toMatchInlineSnapshot(`"testId/defg/x"`);
  });
});
