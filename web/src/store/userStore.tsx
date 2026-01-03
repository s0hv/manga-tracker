import {
  type PropsWithChildren,
  createContext,
  useContext,
  useState,
} from 'react';
import { createStore, useStore } from 'zustand';

import type { Theme } from '@/types/dbTypes';


export interface FrontendUser {
  uuid: string
  username: string | null
  theme: Theme
  admin: boolean
}

export interface FrontendUserForProfile extends FrontendUser {
  email: string
  isCredentialsAccount: boolean
}

interface UserStore {
  user: FrontendUser | null

  actions: {
    setUser: (user: FrontendUser | null) => void
  }
}

const createUserStore = (initProps: Pick<UserStore, 'user'>) => {
  return createStore<UserStore>()(set => ({
    ...initProps,

    actions: {
      setUser: user => set({ user }),
    },
  }));
};

export const UserStoreContext = createContext<ReturnType<typeof createUserStore> | null>(null);

export function UserStoreProvider({ children, ...props }: PropsWithChildren<Pick<UserStore, 'user'>>) {
  const [store] = useState(() => createUserStore(props));

  return <UserStoreContext.Provider value={store}>{children}</UserStoreContext.Provider>;
}

function useUserContext<T>(selector: (state: UserStore) => T): T {
  const store = useContext(UserStoreContext);
  if (!store) throw new Error('Missing UserStoreContext.Provider in the tree');

  return useStore(store, selector);
}

export const useUser = () => useUserContext(s => s.user);
export const useIsUserAdmin = () => useUserContext(s => Boolean(s.user?.admin));
export const useIsUserAuthenticated = () => useUserContext(s => Boolean(s.user));
export const useUserActions = () => useUserContext(s => s.actions);
