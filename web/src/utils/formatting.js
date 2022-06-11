export const formatChapterTitle = ({ title, chapterNumber, chapterDecimal }) => {
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
 * @returns {*|undefined}
 */
export const formatChapterUrl = (chapterUrlFormat, chapterIdentifier, titleId='') => (chapterUrlFormat ?
  chapterUrlFormat.replace('{}', chapterIdentifier).replace('{title_id}', titleId) :
  undefined
);
