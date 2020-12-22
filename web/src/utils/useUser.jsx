import { createContext, useContext, useMemo } from 'react';


const UserContext = createContext(undefined);
export const UserProvider = UserContext.Provider;

export const useUser = () => {
  const user = useContext(UserContext);
  return useMemo(() => ({
    user,
    isAuthenticated: !!user,
    isAdmin: user && user.admin,
  }), [user]);
};
