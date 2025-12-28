import type { Request, Response } from 'express-serve-static-core';
import { z } from 'zod';

import { logger } from '@/serverUtils/logging';

import {
  type CallbackHandler,
  finishLoginCallback,
  getOauthTokens,
} from './common';

export const DiscordUser = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
});

export const discordCallbackHandler: CallbackHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  const tokens = await getOauthTokens('discord', req, res);

  // Failed to get tokens
  if (!tokens) return;


  const discordUserResponse = await fetch('https://discord.com/api/users/@me', {
    headers: {
      Authorization: `Bearer ${tokens.accessToken()}`,
    },
  });

  const discordUserParsed = await discordUserResponse.json();

  const userParsed = DiscordUser.safeParse(discordUserParsed);

  if (!userParsed.success) {
    logger.error('Failed to parse discord user during login');
    res.status(400).end();
    return;
  }

  await finishLoginCallback(
    'discord',
    {
      username: userParsed.data.username,
      accountId: userParsed.data.id,
      email: userParsed.data.email,
    },
    req,
    res
  );
};
