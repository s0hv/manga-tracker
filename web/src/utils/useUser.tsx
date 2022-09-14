import { createContext, useContext, useMemo } from 'react';
import type { SessionUser } from '@/types/dbTypes';


const UserContext = createContext<SessionUser | undefined>(undefined);
export const UserProvider = UserContext.Provider;

export const useUser = () => {
  const user = useContext(UserContext);
  return useMemo(() => ({
    user,
    isAuthenticated: !!user,
    isAdmin: user && user.admin,
  }), [user]);
};
