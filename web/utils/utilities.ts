export const getOptionalNumberParam = (value: any, defaultValue: number, paramName='Value') => {
  if (value === undefined) {
    return defaultValue;
  }
  const val = Number(value);
  if (!Number.isFinite(val)) {
    throw new TypeError(`${paramName} value ${value} is not a number`);
  }
  return val;
};

// https://stackoverflow.com/a/34427278/6046713
export const createSingleton = <T>(key: string, createValue: () => T): T => {
  const s: unique symbol = Symbol.for(key);
  let scope: T | undefined = (global as unknown as any)[s] as T | undefined;
  if (!scope) {
    scope = createValue();
    (global as unknown as any)[s] = scope;
  }
  return scope!;
};
