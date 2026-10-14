/** Must stay in sync with `Status` in the scraper's `src/enums.py`, which writes these values to `manga_info.status`. */
export const MangaStatus = {
  ONGOING: 0,
  COMPLETED: 1,
  DROPPED: 2,
  HIATUS: 3,
} as const;

export type MangaStatus = (typeof MangaStatus)[keyof typeof MangaStatus];
