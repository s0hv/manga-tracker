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
      login(user: { email: string; password: string }, expectFail?: boolean, rememberMe?: boolean): Chainable<void>;
      logout(): Chainable<void>;
      expectLightTheme(): Chainable<void>;
      expectDarkTheme(): Chainable<void>;
      selectComboboxValue(name: string | RegExp, option: string | RegExp): Chainable<void>;
      /**
       * Waits until React has hydrated the server rendered page,
       * as clicks on server rendered elements are ignored until hydration completes.
       * cy.visit and cy.reload already call this, so it is only needed after other full page loads.
       */
      waitForHydration(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('login', (user, expectFail = false, rememberMe = false) => {
  cy.getCookie(sessionCookieName).should('be.null');
  cy.visit('/login');

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

  // Signing in reloads the document, and the user menu only exists after that reload.
  // The hydration wait must come after the menu check so it cannot pass on the old login page.
  cy.findByRole('button', { name: /account of current user/i }).should('exist');
  cy.waitForHydration();
  cy.getCookie(sessionCookieName).should('not.be.null');
});

Cypress.Commands.add('logout', () => {
  cy.findByRole('button', { name: /account of current user/i }).click();

  cy.findByRole('menuitem', { name: /^logout$/i }).click();
  cy.findByRole('button', { name: /account of current user/i }).should('not.exist');
  cy.getCookie(sessionCookieName).should('be.null');
});

Cypress.Commands.add('expectLightTheme', () => {
  cy.get('body').should('have.css', 'background-color', 'rgb(255, 255, 255)');
});

Cypress.Commands.add('expectDarkTheme', () => {
  cy.get('body').should('have.css', 'background-color', 'rgb(18, 18, 18)');
});

Cypress.Commands.add('waitForHydration', () => {
  cy.log('Waiting for hydration');
  cy.get('html[data-hydrated="true"]');
});

// The original visit and reload return a promise instead of a chainable, and Cypress forbids
// queueing cy commands inside a returned promise, so it must be wrapped before chaining.
// The wrap timeout must be at least pageLoadTimeout so it does not fail before the page load does.
const waitForHydrationAfterPageLoad = (pageLoad: Cypress.Chainable<Cypress.AUTWindow>) =>
  cy.wrap(pageLoad, { log: false, timeout: Cypress.config('pageLoadTimeout') })
    .then(win => cy.waitForHydration().then(() => win));

Cypress.Commands.overwrite('visit', (originalFn, ...args) =>
  waitForHydrationAfterPageLoad(originalFn(...args)));

Cypress.Commands.overwrite('reload', (originalFn, ...args) =>
  waitForHydrationAfterPageLoad(originalFn(...args)));

Cypress.Commands.add('selectComboboxValue', (name, option) => {
  cy.findByRole('combobox', { name: name }).click();
  cy.findByRole('option', { name: option }).click();
});

Cypress.on('uncaught:exception', err => {
  if (err.message.includes('Minified React error #418')) {
    return false;
  }
});
