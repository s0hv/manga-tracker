export type Manga = {
  mangaId: number
  title: string
  releaseInterval: Date | null
  latestRelease: Date | null
  estimatedRelease: Date | null
  latestChapter: number | null
  views: number
}
