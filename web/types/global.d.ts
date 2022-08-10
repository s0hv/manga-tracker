import { SessionUser, Theme } from './dbTypes';


declare module 'express-session' {
  interface SessionData {
    user: SessionUser;
    userId?: number,
    theme: Theme
    mangaViews: Record<string, number>
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user: SessionUser;
  }

  interface Express {
    sessionStore: import('../db/session-store').default
  }
}

declare module 'supertest' {
  interface Test extends superagent.SuperAgentRequest {
    csrf(): Test
    satisfiesApiSpec(): Test
  }
}

