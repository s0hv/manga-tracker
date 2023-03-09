/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
// declare global {
//   namespace Cypress {
//     interface Chainable {
//       login(email: string, password: string): Chainable<void>
//       drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
//     }
//   }
// }
import '@testing-library/cypress/add-commands';
import type { TestUser } from '../../__tests__/constants';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      login(user: TestUser): Chainable<void>
      logout(): Chainable<void>
    }
  }
}

Cypress.Commands.add('login', (user) => {
  cy.findByRole('button', { name: /login/i }).click();

  cy.findByRole('textbox', { name: /email address/i }).type(user.email);
  cy.findByLabelText(/password/i).type(user.password);
  cy.findByRole('button', { name: /^sign in$/i }).click();
  cy.findByText(/^recent releases \(for your follows\)/i);
});

Cypress.Commands.add('logout', () => {
  cy.findByRole('button', { name: /account of current user/i }).click();

  cy.findByRole('menuitem', { name: /^logout$/i }).click();
  cy.findByText(/^recent releases$/i);
});
