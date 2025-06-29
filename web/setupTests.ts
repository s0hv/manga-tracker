import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { config } from 'dotenv';
import * as extendedMatchers from 'jest-extended';
import request, { type Test as TestType } from 'supertest';
import { afterEach, expect, vi } from 'vitest';

import { theme } from '@/webUtils/theme';


expect.extend(extendedMatchers);

config({ path: '../.env' });

afterEach(() => {
  cleanup();
});

// Don't want API calls to 3rd party services during tests
vi.mock('@/db/mangadex', () => ({
  MANGADEX_ID: 2,
  fetchExtraInfo: vi.fn().mockImplementation(async () => {}),
}));

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const Test = request.Test as TestType & { prototype: any };

/**
 * Helper function to add csrf token to request
 * @memberOf supertest.Test
 */
Test.prototype.csrf = function csrf(): TestType {
  return this.set('Origin', '/');
};

/**
 * Helper function to check if response matches OpenAPI spec
 * @memberOf supertest.Test
 */
Test.prototype.satisfiesApiSpec = function satisfiesApiSpec(): TestType {
  return this.expect((res: any) => expect(res).toSatisfyApiSpec());
};

vi.mock('next');
vi.mock('next/router');
vi.mock('next/font/google', () => {
  return {
    Roboto: vi.fn().mockReturnValue({ style: { fontFamily: 'test' }}),
  };
});
vi.mock('date-fns');

// CssVarsProvider cannot be used as it expects a working DOM
// which is not fully provided by the testing framework
vi.mock('@mui/material/styles', async () => {
  // eslint-disable-next-line @next/next/no-assign-module-variable
  const module = await vi.importActual<typeof import('@mui/material/styles')>('@mui/material/styles');
  let cachedTheme: any = null;

  return {
    ...module,
    useColorScheme: vi.fn().mockReturnValue({
      setMode: vi.fn(),
      mode: 'dark',
      systemMode: 'dark',
    }),

    // Mock styled so that the vars property of theme can be injected in as it's not
    // present in the default theme
    styled: (args: any) => {
      const retval = module.styled(args);
      return (v: any) => {
        if (typeof v !== 'function') return retval(v);

        return retval((obj: any) => {
          if (!cachedTheme) {
            cachedTheme = {
              ...obj.theme,
              ...theme,
            };

            cachedTheme.vars = theme.colorSchemes.dark;
            cachedTheme.getColorSchemeSelector = () => 'test';
          }
          obj.theme = cachedTheme;

          return v(obj);
        });
      };
    },
  } satisfies typeof import('@mui/material/styles');
});
