export enum Theme {
  Automatic = 0,
  Light = 1,
  Dark = 2
}

export interface SessionUser {
    username: string,
    uuid: string,
    userId: number,
    theme: Theme,
    admin: boolean,
}
