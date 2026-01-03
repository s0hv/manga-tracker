import { type OAuthProvider } from '@/common/auth/providers';

import { type CallbackHandler, oauthLoginHandler, router } from './common';
import { discordCallbackHandler } from './discord';


const registerProviderRoute = (provider: OAuthProvider, callbackHandler: CallbackHandler) => {
  router.get(`/${provider}`, (req, res) => {
    return oauthLoginHandler(provider, req, res);
  });

  router.get(`/${provider}/callback`, (req, res) => {
    return callbackHandler(req, res);
  });
};

registerProviderRoute('discord', discordCallbackHandler);
