import { normalUser } from '../../__tests__/constants';

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
        cy.findByRole('alert', { name: /^sign in failed/i });
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

