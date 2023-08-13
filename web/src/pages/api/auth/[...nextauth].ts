import NextAuth, { type NextAuthOptions } from 'next-auth';
import type { Request, Response } from 'express-serve-static-core';
import { randomUUID } from 'crypto';
import type {
  OAuthConfig,
  OAuthUserConfig,
  Provider,
} from 'next-auth/providers';
import CredentialsProvider from 'next-auth/providers/credentials';
import DiscordProvider from 'next-auth/providers/discord';
import GoogleProvider from 'next-auth/providers/google';
import type { NextApiRequest, NextApiResponse } from 'next';
import { decode, encode } from 'next-auth/jwt';
import { setCookie } from 'cookies-next';

import { getSingletonPostgresAdapter } from '@/db/postgres-adapter';
import { db } from '@/db/helpers';
import { authenticate } from '@/db/auth';
import { limiterSlowBruteByIP } from '@/serverUtils/ratelimits';
import { logger, userLogger } from '@/serverUtils/logging';
import { cookiePrefix, isSecure } from '@/serverUtils/constants';


const authOptionsBase = {
  adapter: getSingletonPostgresAdapter(db),
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },

  pages: {
    signIn: '/login',
  },
} satisfies Partial<NextAuthOptions>;

const isCredentialsRequest = (req: NextApiRequest): boolean | undefined => {
  return (
    req.query.nextauth?.includes('callback') &&
    req.query.nextauth?.includes('credentials') &&
    req.method === 'POST'
  );
};

const extraProviders: Provider[] = [

];

type Providers = 'Discord' | 'Google'
const Providers: Record<Providers, (options: OAuthUserConfig<any>) => OAuthConfig<any>> = {
  Discord: DiscordProvider,
  Google: GoogleProvider,
} as const;

const registerProvider = (prefix: keyof typeof Providers): void => {
  logger.info(`Registering ${prefix} OAuth provider`);
  const clientId = process.env[`${prefix.toUpperCase()}_CLIENT_ID`];
  if (!clientId) return;

  const clientSecret = process.env[`${prefix.toUpperCase()}_CLIENT_SECRET`];
  if (!clientSecret) {
    logger.error(`Client id provided for provider ${prefix} without client secret`);
    return;
  }

  extraProviders.push(Providers[prefix]({
    clientId,
    clientSecret,
  }));
};

registerProvider('Discord');
registerProvider('Google');


export default function nextauth(req: NextApiRequest & Request, res: NextApiResponse & Response) {
  return NextAuth(req, res, {
    ...authOptionsBase,

    // Configure one or more authentication providers
    providers: [
      CredentialsProvider({
        name: 'Credentials',
        credentials: {
          email: { type: 'text' },
          password: { type: 'password' },
          rememberme: { type: 'checkbox' },
        },
        async authorize(credentials) {
          if (!credentials) return null;

          const ratelimit = await limiterSlowBruteByIP.get(req.ip);

          if (ratelimit !== null && ratelimit.remainingPoints <= 0) {
            throw new Error('Ratelimited. Try again later');
          }

          return authenticate(credentials.email, credentials.password)
            .then(user => {
              if (!user) {
                return limiterSlowBruteByIP.consume(req.ip)
                  .then(() => null)
                  .catch(() => null);
              }

              return user;
            })
            .catch((err) => {
              userLogger.error(err, 'Failed to authenticate user');
              throw new Error('Unknown error occurred');
            });
        },
      }),
      ...extraProviders,
    ],

    callbacks: {
      async redirect({ url, baseUrl }) {
        // Allows relative callback URLs
        if (url.startsWith('/')) return `${baseUrl}${url}`;
        // Allows callback URLs on the same origin
        if (new URL(url).origin === baseUrl) return url;

        return baseUrl;
      },

      async signIn({ user, credentials }) {
        if (!isCredentialsRequest(req)) return true;

        if (!user || !user.id) return true;

        const adapter = authOptionsBase.adapter!;
        const sessionToken = randomUUID();
        const day = 24 * 60 * 60 * 1000;
        const sessionExpiry = new Date(Date.now() + ((credentials as any)?.rememberme === 'on' ? day * 30 : day));

        await adapter.createSession({
          sessionToken,
          userId: user.id,
          expires: sessionExpiry,
        });

        // res.cookie() for some reason doesn't play nice when called from here.
        // The old value is not overwritten which causes problems.
        setCookie(
          cookiePrefix + 'next-auth.session-token',
          sessionToken,
          {
            req,
            res,
            // I think this gets immediately updated to maxAge but stays ok in the database
            expires: sessionExpiry,
            sameSite: 'lax',
            httpOnly: true,
            secure: isSecure,
          }
        );

        return true;
      },
    },

    jwt: {
      encode(params) {
        if (isCredentialsRequest(req)) {
          const cookie = req.cookies[cookiePrefix + 'next-auth.session-token'];
          if (typeof cookie === 'string' && cookie) return cookie;
          return '';
        }
        // Revert to default behaviour when not in the credentials provider callback flow
        return encode(params);
      },
      async decode(params) {
        if (isCredentialsRequest(req)) {
          return null;
        }
        // Revert to default behaviour when not in the credentials provider callback flow
        return decode(params);
      },
    },

    events: {
      async signOut({ session }) {
        // If delete user was set within the last minute delete the user
        if (session.userId && session.deleteUser && (Date.now() - session.deleteUser.getTime()) < 60 * 1000) {
          try {
            await authOptionsBase.adapter!.deleteUser!(session.userId);
          } catch (e) {
            userLogger.error(e, 'Failed to delete user');
            throw e;
          }
        } else if (session.userId) {
          return authOptionsBase.adapter!.updateUserLastActivity(session.userId);
        }
      },

      signIn({ user, isNewUser }) {
        if (isNewUser || !user) return;

        return authOptionsBase.adapter!.updateUserLastActivity(user.id);
      },
    },
  });
}
