export type ChapterNumber = {
  chapterNumber: number;
  chapterDecimal: number | null;
};

// The decimal part is stored as an integer, so a leading zero (12.05) cannot be told apart from 12.5
const chapterNumberPattern = /^(\d+)(?:\.([1-9]\d*))?$/;

/**
 * Parses a chapter number such as "12" or "12.5".
 * @returns null when the value cannot be stored as a chapter number
 */
export const parseChapterNumber = (value: string): ChapterNumber | null => {
  const match = chapterNumberPattern.exec(value.trim());
  if (!match) return null;

  return {
    chapterNumber: Number(match[1]),
    chapterDecimal: match[2] ? Number(match[2]) : null,
  };
};
