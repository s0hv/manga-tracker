import type { AuthToken } from '@/types/db/auth';
import type { Session } from '@/types/session';

import { normalUser } from '../../../__tests__/constants';
import { authTokenCookieName, sessionCookieName } from '../../constants';

describe('Login features', () => {
  describe('Login redirect works', () => {
    it('Redirects back to /manga/1 after logging in', () => {
      cy.task('flushRedis');
      cy.visit('/manga/1');

      cy.wait(500);

      cy.findByRole('link', { name: /login/i }).click();

      cy.getAllCookies().should('have.length', 1);

      cy.wait(300);
      cy.findByRole('textbox', { name: /email address/i }).focus().type(normalUser.email);
      cy.findByLabelText(/password/i).type(normalUser.password);
      cy.findByRole('button', { name: /^sign in$/i }).click();
      cy.url().should('contain', '/manga/1');
    });
  });

  describe('Remember me logic works', () => {
    const day = 1000 * 60 * 60 * 24;
    const minute = 1000 * 60;
    const hour = minute * 60;

    it('Remembers user after logging in', () => {
      cy.task('flushRedis');
      cy.visit('/');

      cy.login(normalUser, false, true);

      cy.getCookie(sessionCookieName)
        .should('not.be.null')
        .then(cookie => {
          // Expiry should be 2 hours for the session
          expect(cookie.expiry * 1000).to.be.greaterThan(Date.now() + hour * 2 - minute * 5);
          expect(cookie.expiry * 1000).to.be.lessThan(Date.now() + hour * 2 + minute * 5);

          cy.wrap(cookie.value).as('sessionToken');
        });

      cy.get<string>('@sessionToken')
        .then(sessionToken => cy.task<Session>('getSession', sessionToken))
        .should('not.be.null')
        .then(session => {
          expect(new Date(session.expiresAt)).to.be.greaterThan(new Date(Date.now() + hour * 2 - minute * 5));
          expect(new Date(session.expiresAt)).to.be.lessThan(new Date(Date.now() + hour * 2 + minute * 5));
        });

      cy.getCookie(authTokenCookieName)
        .should('not.be.null')
        .then(cookie => {
          // Expiry should be 30 days for the remember me token
          expect(cookie.expiry * 1000).to.be.greaterThan(Date.now() + day * 29);
          expect(cookie.expiry * 1000).to.be.lessThan(Date.now() + day * 31);

          cy.wrap(cookie.value).as('authToken');
        });

      cy.get<string>('@authToken')
        .then(authToken => cy.task<AuthToken>('getAuthToken', authToken))
        .should('not.be.null')
        .then((authToken: any) => {
          expect(new Date(authToken.expiresAt)).to.be.greaterThan(new Date(Date.now() + day * 29));
          expect(new Date(authToken.expiresAt)).to.be.lessThan(new Date(Date.now() + day * 31));
        });
    });

    it('Sets 2 hour expiry date without remember me', () => {
      cy.task('flushRedis');
      cy.visit('/');

      cy.login(normalUser);

      cy.getCookie(sessionCookieName)
        .should('not.be.null')
        .then(cookie => {
          // Expiry should be 2 hours for the session
          expect(cookie.expiry * 1000).to.be.greaterThan(Date.now() + hour * 2 - minute * 5);
          expect(cookie.expiry * 1000).to.be.lessThan(Date.now() + hour * 2 + minute * 5);

          cy.wrap(cookie.value).as('sessionToken');
        });

      cy.get<string>('@sessionToken')
        .then(sessionToken => cy.task<Session>('getSession', sessionToken))
        .should('not.be.null')
        .then(session => {
          expect(new Date(session.expiresAt)).to.be.greaterThan(new Date(Date.now() + hour * 2 - minute * 5));
          expect(new Date(session.expiresAt)).to.be.lessThan(new Date(Date.now() + hour * 2 + minute * 5));
        });

      // Auth token should not exists here
      cy.getCookie(authTokenCookieName)
        .should('be.null');
    });
  });
});
