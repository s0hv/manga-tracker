import { createContext, useContext, useMemo } from 'react';

import type { Theme } from '@/types/dbTypes';

export type FrontendUser = {
  uuid: string
  username: string | null
  theme: Theme
  admin: boolean
  isCredentialsAccount: boolean
};

const UserContext = createContext<FrontendUser | undefined | null>(undefined);
export const UserProvider = UserContext.Provider;

export const useUser = () => {
  const user = useContext(UserContext);
  return useMemo(() => ({
    user,
    isAuthenticated: !!user,
    isAdmin: user?.admin,
  }), [user]);
};
