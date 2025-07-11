import { nextAuthSessionCookie } from '../../constants';
import { CreatedUser } from '../../types';

describe('Account data management', () => {
  describe('Request account data', () => {
    it('is possible to download your data', () => {
      cy.task('flushRedis');

      // Create a new user and log in
      cy.task<CreatedUser>('createUser')
        .then(user => {
          cy.wrap(user).as('user');
        });

      cy.get<CreatedUser>('@user')
        .then(user => cy.login(user));

      // Go to profile page
      cy.findByRole('button', { name: /account of current user/i }).click();
      cy.findByRole('menuitem', { name: /^profile$/i }).click();
      cy.findByRole('button', { name: /Download a copy of personal data/i }).click();

      cy.intercept({
        pathname: '/api/user/dataRequest',
        method: 'POST',
      }, req => {
        req.redirect('/profile');
      }).as('userData');

      // Initiate data download
      cy.findByRole('button', { name: /proceed/i }).click();

      cy.wait('@userData').its('request').then(req => {
        cy.request(req)
          .then(({ body, headers }) => {
            expect(headers).to.have.property('content-disposition', 'attachment; filename="manga-tracker-user-data.json"');
            expect(body).to.include.keys(['user', 'accounts', 'sessions', 'notifications', 'follows']);
          });
      });
    });
  });

  describe('Delete account', () => {
    it('is possible to delete your own account', () => {
      cy.task('flushRedis');

      // Create a new user and log in
      cy.task<CreatedUser>('createUser')
        .then(user => {
          cy.wrap(user).as('user');
        });

      cy.get<CreatedUser>('@user')
        .then(user => cy.login(user));

      // Go to profile page
      cy.findByRole('button', { name: /account of current user/i }).click();
      cy.findByRole('menuitem', { name: /^profile$/i }).click();
      cy.findByRole('button', { name: /delete account/i }).click();

      // Initiate account deletion
      cy.findByRole('button', { name: /delete account/i }).should('be.disabled');

      cy.get<CreatedUser>('@user')
        .then(user => {
          cy.findByText(new RegExp(`Type "${user.username}" to acknowledge this`));
          cy.findByRole('textbox').type(user.username);
        });

      cy.findByRole('button', { name: /delete account/i }).click();

      cy.url().should('include', '/login');
      cy.getCookie(nextAuthSessionCookie).should('be.null');

      // Trying to log in again with the deleted account should fail
      cy.get<CreatedUser>('@user')
        .then(user => cy.login(user, true));

      // Next.js adds another alert element outside the main element so we need to filter that out
      cy.findByRole('main').within(() => {
        cy.findByRole('alert').within(() => {
          cy.findByText(/^sign in failed/i);
        });
      });

      cy.task('flushRedis');
    });
  });
});
