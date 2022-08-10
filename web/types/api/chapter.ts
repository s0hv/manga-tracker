export type MangaChapter = {
  chapterId: number
  title: string
  chapterNumber: number
  chapterDecimal: number | null
  releaseDate: Date
  group: string
  serviceId: number
  chapterIdentifier: string
}

export type MangaChapterResponse = {
  count: number | string
  chapters: MangaChapter[]
  exists: boolean
}
