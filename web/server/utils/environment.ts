import { z } from 'zod';

const Environment = z.literal(['development', 'production', 'test']);
export type Environment = z.infer<typeof Environment>;

interface CustomEnv {
  HOST: string
  COOKIE_SECRET: string
  TRUST_PROXY?: string
  CYPRESS?: string
  NODE_ENV?: string
  // Environment info. Helps differentiate environment in deployed versions of the app.
  // For example, in a test deployment.
  ENVIRONMENT?: Environment
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    export interface ProcessEnv extends CustomEnv {}
  }
}

const REQUIRED_VARS = ['HOST', 'COOKIE_SECRET'] satisfies (keyof CustomEnv)[];

export const validateEnv = () => {
  REQUIRED_VARS.forEach(varToCheck => {
    if (!process.env[varToCheck]) {
      throw new Error(`Missing environment variable: ${varToCheck}`);
    }
  });

  // Make sure that host is a valid URL
  new URL(process.env.HOST);

  // Ensure environment value is valid
  if (process.env.ENVIRONMENT) {
    Environment.parse(process.env.ENVIRONMENT);
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('Environment must be specified when NODE_ENV is "production"');
  }
};
