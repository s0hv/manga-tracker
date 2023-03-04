import NextAuth, { type NextAuthOptions } from 'next-auth';
import type { Request, Response } from 'express-serve-static-core';
import { randomUUID } from 'crypto';
import CredentialsProvider from 'next-auth/providers/credentials';
import DiscordProvider from 'next-auth/providers/discord';
import type { NextApiRequest, NextApiResponse } from 'next';
import { decode, encode } from 'next-auth/jwt';
import { setCookie } from 'cookies-next';

import { getSingletonPostgresAdapter } from '@/db/postgres-adapter';
import { db } from '@/db/helpers';
import { authenticate } from '@/db/auth';
import { limiterSlowBruteByIP } from '@/serverUtils/ratelimits';
import { userLogger } from '@/serverUtils/logging';


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
      DiscordProvider({
        clientId: process.env.DISCORD_ID!,
        clientSecret: process.env.DISCORD_SECRET!,
      }),
    ],

    callbacks: {
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
          'next-auth.session-token',
          sessionToken,
          {
            req,
            res,
            // I think this gets immediately updated to maxAge but stays ok in the database
            expires: sessionExpiry,
            sameSite: 'lax',
            httpOnly: true,
            secure: (process.env.NEXTAUTH_URL || '').startsWith('https://'),
          }
        );

        return true;
      },
    },

    jwt: {
      encode(params) {
        if (isCredentialsRequest(req)) {
          const cookie = req.cookies['next-auth.session-token'];
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
  });
}
