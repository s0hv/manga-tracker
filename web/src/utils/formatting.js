export const formatChapterTitle = ({ title, chapterNumber, chapterDecimal }) => {
  const prefix = `Chapter ${chapterNumber}${chapterDecimal ? '.' + chapterDecimal : ''}`;
  if (title === undefined || /chapter \d(\.\d+)?/i.test(title)) {
    return prefix;
  }

  return `${prefix} – ${title}`;
};

export const formatChapterUrl = (chapterUrlFormat, chapterIdentifier) => (chapterUrlFormat ?
  chapterUrlFormat.replace('{}', chapterIdentifier) :
  undefined
);
