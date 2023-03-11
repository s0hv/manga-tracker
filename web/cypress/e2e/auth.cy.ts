import { normalUser } from '../../__tests__/constants';
import { nextAuthSessionCookie } from '../constants';
import type { CreatedUser } from '../types';

describe('Test authentication', () => {
  it('Logs in with correct email + password', () => {
    cy.task('flushRedis');
    cy.visit('/');
    cy.findByText(/^recent releases$/i);

    cy.findByRole('button', { name: /login/i }).click();

    cy.findByRole('textbox', { name: /email address/i }).type(normalUser.email);
    cy.findByLabelText(/password/i).type(normalUser.password);
    cy.findByRole('button', { name: /^sign in$/i }).click();
    cy.findByText(/^recent releases \(for your follows\)/i);
  });

  it('Ratelimits after 3 failed login attempts', () => {
    cy.task('flushRedis');

    const login = () => {
      cy.visit('/login');
      cy.findByRole('textbox', { name: /email address/i }).clear().type(normalUser.email);
      cy.findByLabelText(/password/i).type('aaaaaaaaa');
      cy.findByRole('button', { name: /^sign in$/i }).click();
    };

    for (let i = 0; i < 2; i++) {
      login();
      if (i === 0) {
        cy.findByRole('alert');
        cy.findByText(/^sign in failed/i);
      }
    }

    // This should not reset the rate limiting
    cy.login(normalUser);
    cy.logout();

    login();

    cy.url().should('include', '/login');

    // 4th time should rate limit
    login();

    cy.url().should('include', '/api/auth/error?error=Ratelimited.%20Try%20again%20later');

    cy.task('flushRedis');
  });
});

describe('Test deleting account', () => {
  it('is possible to delete your own account', () => {
    // Create a new user and log in
    cy.task<CreatedUser>('createUser')
      .then(user => {
        cy.wrap(user).as('user');
      });

    cy.get<CreatedUser>('@user')
      .then((user) => cy.login(user));

    // Go to profile page
    cy.findByRole('button', { name: /account of current user/i }).click();
    cy.findByRole('menuitem', { name: /^profile$/i }).click();
    cy.findByRole('button', { name: /delete account/i }).click();

    // Initiate account deletion
    cy.findByRole('button', { name: /delete account/i }).should('be.disabled');

    cy.get<CreatedUser>('@user')
      .then((user) => {
        cy.findByText(new RegExp(`Type "${user.username}" to acknowledge this`));
        cy.findByRole('textbox').type(user.username);
      });

    cy.findByRole('button', { name: /delete account/i }).click();

    cy.url().should('include', '/login');
    cy.getCookie(nextAuthSessionCookie).should('be.null');

    // Trying to log in again with the deleted account should fail
    cy.get<CreatedUser>('@user')
      .then((user) => cy.login(user, true));

    cy.findByRole('alert');
    cy.findByText(/^sign in failed/i);

    cy.task('flushRedis');
  });
});
