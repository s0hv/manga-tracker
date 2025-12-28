import * as crypto from 'node:crypto';

export const getOptionalNumberParam = (value: any, defaultValue: number, paramName = 'Value') => {
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

// https://lucia-auth.com/sessions/basic
export const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  let c = 0;
  for (let i = 0; i < a.byteLength; i++) {
    c |= a[i] ^ b[i];
  }
  return c === 0;
};

export const generateSecureRandomBytes = (length: number): Uint8Array => {
  if (!length) throw new Error('Length must be greater than 0 when generating secure random bytes.');

  // 24 bytes = 192 bits of entropy.
  // 15 bytes = 120 bits of entropy.
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  return bytes;
};

export const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  return Buffer.from(bytes).toString('base64');
};

export const base64toUint8Array = (base64: string): Uint8Array => {
  return Buffer.from(base64, 'base64');
};

export const hashSecret = async (secret: Uint8Array | string): Promise<Uint8Array> => {
  const secretBytes = typeof secret === 'string'
    ? new TextEncoder().encode(secret)
    : secret;

  const secretHashBuffer = await crypto.subtle.digest('SHA-256', secretBytes);
  return new Uint8Array(secretHashBuffer);
};
