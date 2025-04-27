import React from 'react';

export type PartialExcept<T, K extends keyof T> = Pick<T, K> & Partial<Omit<T, K>>;
export type RequiredExcept<T, K extends keyof T> = Required<Omit<T, K>> & Partial<Pick<T, K>>;

/**
 * All parameters are of the base type except the ones given are partial
 */
export type DefaultExcept<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// https://twitter.com/mattpocockuk/status/1622730173446557697
export type FlattenType<T> = {
  [K in keyof T]: T[K]
// eslint-disable-next-line @typescript-eslint/ban-types
} & {};

export type SelectOption = {
  label: string | number | React.ReactElement
  value: string | number | undefined
  disabled?: boolean
};
