import { describe, expect, it } from 'vitest';

import { parseChapterNumber } from '@/webUtils/chapterNumber';

describe('parseChapterNumber', () => {
  it.each([
    ['12', { chapterNumber: 12, chapterDecimal: null }],
    ['12.5', { chapterNumber: 12, chapterDecimal: 5 }],
    ['12.15', { chapterNumber: 12, chapterDecimal: 15 }],
    ['0', { chapterNumber: 0, chapterDecimal: null }],
    [' 7.1 ', { chapterNumber: 7, chapterDecimal: 1 }],
  ])('Parses %j', (input, expected) => {
    expect(parseChapterNumber(input)).toEqual(expected);
  });

  it.each([
    '',
    'abc',
    '12abc',
    '12.3x',
    '1.2.3',
    '12.',
    '.5',
    '-1',
    // A decimal with a leading zero cannot be stored, as it would be read back as 12.5
    '12.05',
    '12.0',
  ])('Rejects %j', input => {
    expect(parseChapterNumber(input)).toBeNull();
  });
});
