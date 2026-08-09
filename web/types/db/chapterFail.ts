export interface ChapterFail {
  chapterIdentifier: string
  serviceId: number
  mangaId: number | null
  errors: string
  title: string | null
  chapterNumber: number | null
  chapterDecimal: number | null
  titleId: string | null
  mangaTitle: string | null
  releaseDate: Date | null
  group: string | null
  timestamp: Date
}
