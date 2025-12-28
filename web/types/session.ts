export interface Session {
  sessionId: string
  sessionSecret: Uint8Array // Uint8Array is a byte array
  userId: number | null
  expiresAt: Date
  data: {
    mangaViews?: Record<string, number>
  } | null
}

export interface SafeSession extends Pick<Session,
  'sessionId'
  | 'userId'
  | 'expiresAt'
  | 'data'
> {
  // This should help with preventing sessionSecret from being included in the data
  sessionSecret?: never
}

export interface SessionWithToken extends Session {
  token: string
}
