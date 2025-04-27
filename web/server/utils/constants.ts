export const csrfMissing = 'CSRF error. Modifying requests must come from the same origin.';
export const isDev = process.env.NODE_ENV !== 'production';
export const isTest = process.env.NODE_ENV === 'test';
export const NO_GROUP = 1;

export const isSecure = (process.env.NEXTAUTH_URL || '').startsWith('https://');
export const cookiePrefix = (process.env.NEXTAUTH_URL || '').startsWith('https://') ? '__Secure-' : '';
