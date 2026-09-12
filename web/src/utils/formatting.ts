type FormatChapterTitleOpts = { title?: string; chapterNumber?: number; chapterDecimal?: number | null };
export const formatChapterTitle = ({ title, chapterNumber, chapterDecimal }: FormatChapterTitleOpts) => {
  const prefix = `Chapter ${chapterNumber}${chapterDecimal ? '.' + String(chapterDecimal) : ''}`;
  if (title === undefined || /chapter \d(\.\d+)?/i.test(title)) {
    return prefix;
  }

  return `${prefix} – ${title}`;
};

/**
 * Format chapter url
 * @param chapterUrlFormat
 * @param chapterIdentifier
 * @param titleId
 */
export const formatChapterUrl = (
  chapterUrlFormat: string | undefined | null,
  chapterIdentifier: string,
  titleId = ''
): string | undefined =>
  chapterUrlFormat
    ? chapterUrlFormat.replace('{}', chapterIdentifier).replace('{title_id}', titleId)
    : undefined;

export const formatTitleUrl = (mangaUrlFormat: string | undefined | null, titleId: string) =>
  mangaUrlFormat
    ? mangaUrlFormat.replace('{}', titleId)
    : undefined;
