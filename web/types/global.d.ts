import type { Request as ExpressRequest } from 'express-serve-static-core';
import type { Location } from 'express-validator';
import type { AdapterSession } from 'next-auth/adapters';

import type { PostgresAdapter } from '@/db/postgres-adapter';

import type { SessionData, SessionUser } from './dbTypes';

declare module 'next-auth/adapters' {

  interface AdapterSession {
    csrfSecret?: string
    data?: SessionData | null
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user: SessionUser | null
    session: AdapterSession | Record<string, never>
    sessionStore: PostgresAdapter
  }

  interface Express {
    sessionStore: PostgresAdapter
  }
}

declare module 'express-validator' {
  interface Meta {
    req: ExpressRequest
    location: Location
    path: string
  }
}

declare module 'supertest' {
  interface Test {
    csrf(): Test
    satisfiesApiSpec(): Test
  }
}

declare module 'next-auth' {
  type User = SessionUser;
  interface Session {
    data?: SessionData | null
    userId: string
    deleteUser: Date | null
  }
}
