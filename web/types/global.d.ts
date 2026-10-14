import type { SafeSession } from '@/types/session';

import type { SessionData, SessionUser } from './dbTypes';

declare module 'next-auth/adapters' {

  interface AdapterSession {
    csrfSecret?: string;
    data?: SessionData | null;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user: SessionUser | null;

    /**
     * This is a helper function to return a strongly typed user.
     *
     * It is a getter because it double-checks that the user is not null.
     *
     * The user validations should still be used to ensure the validation
     * is done early and for proper error handling.
     */
    getUser(): SessionUser;
    session: SafeSession | null;
    isStaticResource?: boolean;
    _nonce?: string;
    getNonce(): string;
  }
}

declare module 'supertest' {
  interface Test {
    csrf(): Test;
    satisfiesApiSpec(): Test;
  }
}
