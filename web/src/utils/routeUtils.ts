import {
  createIsomorphicFn,
  getGlobalStartContext,
} from '@tanstack/react-start';

import { validateIsLoggedIn } from '#web/serverFunctions/validation';

import type { FrontendUser } from '../store/userStore';

/**
 * Validates that the user is logged in by checking the `frontendUser`
 * property of the given context. Will throw a redirect to `/login`,
 * if unauthenticated
 */
export async function validateLoggedIn(context: { frontendUser: FrontendUser | null }) {
  if (context.frontendUser) {
    return;
  }

  // If login information is not available in the context,
  // do the validation on the server
  await validateIsLoggedIn();
}

/**
 * Nonce for scripts
 * @see https://github.com/TanStack/router/discussions/3028#discussioncomment-14897719
 */
export const getCspNonce = createIsomorphicFn()
  .server(() => {
    const ctx = getGlobalStartContext();

    return ctx?.nonce;
  })
  .client(() => {
    const el = document.querySelector(
      'meta[property=csp-nonce]'
    ) as HTMLMetaElement;

    return el.content;
  });
