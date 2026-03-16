import { afterEach, describe, expect, it, vi } from 'vitest';

import { validateEnv } from '@/serverUtils/environment';

afterEach(() => vi.unstubAllEnvs());

describe('validateEnv', () => {
  it.each([
    'HOST',
    'COOKIE_SECRET',
  ])('Should throw on missing environment variable "%s"', envVar => {
    vi.stubEnv(envVar, '');
    expect(validateEnv).toThrowWithMessage(Error, `Missing environment variable: ${envVar}`);
  });

  it('Should throw when HOST is not a valid URL', () => {
    vi.stubEnv('HOST', 'test');
    expect(validateEnv).toThrowErrorMatchingInlineSnapshot(`[TypeError: Invalid URL]`);
  });

  it('Should throw when ENVIRONMENT is not a valid value', () => {
    vi.stubEnv('ENVIRONMENT', 'abc');
    expect(validateEnv).toThrowErrorMatchingInlineSnapshot(`
      [ZodError: [
        {
          "code": "invalid_value",
          "values": [
            "development",
            "production",
            "test",
            "unit-test"
          ],
          "path": [],
          "message": "Invalid option: expected one of \\"development\\"|\\"production\\"|\\"test\\"|\\"unit-test\\""
        }
      ]]
    `);
  });

  it('Should force specifying an environment when NODE_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ENVIRONMENT', '');
    expect(validateEnv).toThrowErrorMatchingInlineSnapshot(`[Error: Environment must be specified when NODE_ENV is "production"]`);
  });
});
