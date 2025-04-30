type FormatChapterTitleOpts = { title: string, chapterNumber: number, chapterDecimal?: number | null }
export const formatChapterTitle = ({ title, chapterNumber, chapterDecimal }: FormatChapterTitleOpts) => {
  const prefix = `Chapter ${chapterNumber}${chapterDecimal ? '.' + chapterDecimal : ''}`;
  if (title === undefined || /chapter \d(\.\d+)?/i.test(title)) {
    return prefix;
  }

  return `${prefix} – ${title}`;
};

/**
 * Format chapter url
 * @param {string?} chapterUrlFormat
 * @param {string} chapterIdentifier
 * @param {string} titleId
 */
export const formatChapterUrl = (chapterUrlFormat: string | undefined, chapterIdentifier: string, titleId: string=''): string | undefined => (chapterUrlFormat ?
  chapterUrlFormat.replace('{}', chapterIdentifier).replace('{title_id}', titleId) :
  undefined
);
