import { normalUser } from '../../../__tests__/constants';
import { nextAuthSessionCookie } from '../../constants';

describe('Login features', () => {
  describe('Login redirect works', () => {
    it('Redirects back to /manga/1 after logging in', () => {
      cy.task('flushRedis');
      cy.visit('/manga/1');

      cy.findByRole('button', { name: /login/i }).click();

      cy.findByRole('textbox', { name: /email address/i }).type(normalUser.email);
      cy.findByLabelText(/password/i).type(normalUser.password);
      cy.findByRole('button', { name: /^sign in$/i }).click();
      cy.url().should('contain', '/manga/1');
    });
  });

  describe('Remember me logic works', () => {
    const day = 1000 * 60 * 60 * 24;
    const hour = 1000 * 60 * 60;

    it('Remembers user after logging in', () => {
      cy.task('flushRedis');
      cy.visit('/');

      cy.login(normalUser, false, true);

      cy.getCookie(nextAuthSessionCookie)
        .should('not.be.null')
        .then(cookie => {
          // Expiry should be 30 days. So between 29 and 31 days
          expect(cookie.expiry * 1000).to.be.greaterThan(Date.now() + day * 29);
          expect(cookie.expiry * 1000).to.be.lessThan(Date.now() + day * 31);

          cy.wrap(cookie.value).as('sessionToken');
        });

      cy.get<string>('@sessionToken')
        .then(sessionToken => cy.task('getSession', sessionToken))
        .should('not.be.null')
        .then((session: any) => {
          expect(new Date(session.expiresAt)).to.be.greaterThan(new Date(Date.now() + day * 29));
          expect(new Date(session.expiresAt)).to.be.lessThan(new Date(Date.now() + day * 31));
        });
    });

    it('Sets 1 day expiry date without remember me', () => {
      cy.task('flushRedis');
      cy.visit('/');

      cy.login(normalUser);

      cy.getCookie(nextAuthSessionCookie)
        .should('not.be.null')
        .then(cookie => {
          // Expiry for the cookie is always 30 days. This is because of next-auth maxAge option.
          // The database will have the correct expiry though so it's an ok compromise for now.
          expect(cookie.expiry * 1000).to.be.greaterThan(Date.now() + day * 29);
          expect(cookie.expiry * 1000).to.be.lessThan(Date.now() + day * 31);

          cy.wrap(cookie.value).as('sessionToken');
        });

      cy.get<string>('@sessionToken')
        .then(sessionToken => cy.task('getSession', sessionToken))
        .should('not.be.null')
        .then((session: any) => {
          expect(new Date(session.expiresAt)).to.be.greaterThan(new Date(Date.now() + day - hour));
          expect(new Date(session.expiresAt)).to.be.lessThan(new Date(Date.now() + day + hour));
        });
    });
  });
});
