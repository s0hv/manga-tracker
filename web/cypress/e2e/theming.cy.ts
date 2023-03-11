import { CreatedUser } from '../types';

describe('Changing theme works', () => {
  it('Change theme for logged in user', () => {
    cy.task<CreatedUser>('createUser')
      .then(user => {
        cy.wrap(user).as('user');
        cy.login(user);
      });

    cy.expectDarkTheme();

    // Switch theme
    cy.findByRole('button', { name: /account of current user/i }).click();
    cy.findByRole('menuitem', { name: /switch to light theme/i }).click();

    cy.expectLightTheme();

    cy.logout();
    cy.get<CreatedUser>('@user').then(cy.login);

    cy.expectLightTheme();
  });

  it('Change theme without user', () => {
    cy.visit('/');
    cy.root().invoke('attr', 'data-mui-color-scheme').as('theme');

    cy.get<string>('@theme').then(theme => {
      if (theme === 'dark') {
        cy.expectDarkTheme();
      } else {
        cy.expectLightTheme();
      }
    });

    cy.findByRole('button', { name: /switch theme/i }).click();

    // Value gets updated on button click
    cy.get<string>('@theme').then(theme => {
      if (theme === 'dark') {
        cy.expectDarkTheme();
      } else {
        cy.expectLightTheme();
      }
    });
  });
});
