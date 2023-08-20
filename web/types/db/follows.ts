export type Follow = {
  title: string,
  cover?: string,
  mangaId: number,
  latestRelease?: string,
  latestChapter?: string,
  services: { serviceId: number, serviceName: string, titleId: string, url: string }[],
  followedServices: (number | null)[]
}
