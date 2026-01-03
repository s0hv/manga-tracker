import { normalUser } from '../../../__tests__/constants';

describe('Test authentication', () => {
  it('Logs in with correct email + password', () => {
    cy.task('flushRedis');
    cy.visit('/');
    cy.findByText(/^recent releases$/i);

    cy.findByRole('link', { name: /login/i }).click();

    cy.wait(300);

    cy.findByRole('textbox', { name: /email address/i }).focus().type(normalUser.email);
    cy.findByLabelText(/password/i).type(normalUser.password);
    cy.findByRole('button', { name: /^sign in$/i }).click();
    cy.findByText(/^recent releases \(for your follows\)/i);
  });

  it('Ratelimits after 3 failed login attempts', () => {
    cy.task('flushRedis');

    const login = () => {
      cy.visit('/login');
      cy.wait(300);
      cy.findByRole('textbox', { name: /email address/i }).focus().clear().type(normalUser.email);
      cy.findByLabelText(/password/i).type('aaaaaaaaa');
      cy.findByRole('button', { name: /^sign in$/i }).click();
    };

    for (let i = 0; i < 2; i++) {
      login();
      if (i === 0) {
        cy.findByRole('alert').within(() => {
          cy.findByText(/Invalid login/i).should('exist');
        });
      }
    }

    // This should not reset the rate limiting
    cy.login(normalUser);
    cy.logout();

    login();

    cy.url().should('include', '/login');

    // 4th time should rate limit
    login();

    cy.findByRole('alert').within(() => {
      cy.findByText(/Ratelimited/i).should('exist');
    });

    cy.task('flushRedis');
  });
});

