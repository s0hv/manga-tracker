import { SessionUser, Theme } from './dbTypes';


declare module 'express-session' {
  interface SessionData {
    user: SessionUser;
    userId?: number,
    theme: Theme
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

