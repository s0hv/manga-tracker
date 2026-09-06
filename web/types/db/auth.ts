export interface AuthToken {
  userId: number
  tokenHash: Uint8Array<ArrayBuffer>
  lookup: string
  expiresAt: Date
}
