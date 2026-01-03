import { Theme } from '@/types/dbTypes';

export type User = {
  userId: number
  username: string
  email: string
  userUuid: string
  theme: Theme
  admin: boolean
  isCredentialsAccount: boolean
};
