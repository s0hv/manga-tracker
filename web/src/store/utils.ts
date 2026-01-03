import { upperFirst } from 'es-toolkit';
import { StoreApi, UseBoundStore } from 'zustand';

export type StoreUseHooks<S> = S extends { getState: () => infer T }
  ? {
    [K in keyof T as K extends string ? `use${Capitalize<K>}` : never]: () => T[K]
  }
  : never;

/**
 * Creates selector hooks for the store in the format `useProperty`
 */
export const createSelectorHooks = <S extends UseBoundStore<StoreApi<object>>>(
  store: S
): StoreUseHooks<S> => {
  const useHooks = {};
  for (const k of Object.keys(store.getState())) {
    (useHooks as any)[`use${upperFirst(k)}`] = () => store(s => s[k as keyof typeof s]);
  }

  return useHooks as StoreUseHooks<S>;
};
