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

import { sessionCookieName } from '../constants';


declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      login(user: { email: string, password: string }, expectFail?: boolean, rememberMe?: boolean): Chainable<void>
      logout(): Chainable<void>
      expectLightTheme(): Chainable<void>
      expectDarkTheme(): Chainable<void>
    }
  }
}

Cypress.Commands.add('login', (user, expectFail = false, rememberMe = false) => {
  cy.getCookie(sessionCookieName).should('be.null');
  cy.visit('/login');

  cy.wait(300);

  cy.findByRole('textbox', { name: /email address/i }).focus().type(user.email);
  cy.findByLabelText(/password/i).focus().type(user.password);

  if (rememberMe) {
    cy.findByRole('checkbox', { name: /remember me/i }).click();
  }

  cy.findByRole('button', { name: /^sign in$/i }).click();
  if (expectFail) {
    cy.getCookie(sessionCookieName).should('be.null');
    return;
  }

  cy.findByText(/^recent releases \(for your follows\)/i);
  cy.getCookie(sessionCookieName).should('not.be.null');

  cy.wait(200);
});

Cypress.Commands.add('logout', () => {
  cy.findByRole('button', { name: /account of current user/i }).click();

  cy.findByRole('menuitem', { name: /^logout$/i }).click();
  cy.findByText(/^recent releases$/i);
  cy.getCookie(sessionCookieName).should('be.null');
});

Cypress.Commands.add('expectLightTheme', () => {
  cy.get('body').should('have.css', 'background-color', 'rgb(255, 255, 255)');
});

Cypress.Commands.add('expectDarkTheme', () => {
  cy.get('body').should('have.css', 'background-color', 'rgb(18, 18, 18)');
});

Cypress.on('uncaught:exception', err => {
  if (err.message.includes('Minified React error #418')) {
    return false;
  }
});
