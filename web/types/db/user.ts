import { Theme } from '@/types/dbTypes';

export type User = {
  userId: number
  username: string
  userUuid: string
  theme: Theme | null
  admin: boolean
}
