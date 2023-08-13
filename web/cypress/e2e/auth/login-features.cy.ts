import { normalUser } from '../../../__tests__/constants';

describe('Login redirect works', () => {
  it.only('Redirects back to /manga/1 after logging in', () => {
    cy.task('flushRedis');
    cy.visit('/manga/1');

    cy.findByRole('button', { name: /login/i }).click();

    cy.findByRole('textbox', { name: /email address/i }).type(normalUser.email);
    cy.findByLabelText(/password/i).type(normalUser.password);
    cy.findByRole('button', { name: /^sign in$/i }).click();
    cy.url().should('contain', '/manga/1');
  });
});
