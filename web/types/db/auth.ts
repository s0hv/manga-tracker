export interface AuthToken {
  userId: number
  tokenHash: Uint8Array
  lookup: string
  expiresAt: Date
}
