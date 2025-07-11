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

  it.only('Change theme without user', () => {
    cy.visit('/');
    cy.root().invoke('hasClass', 'dark').as('isDarkTheme');

    cy.get<boolean>('@isDarkTheme').then(isDarkTheme => {
      if (isDarkTheme) {
        cy.expectDarkTheme();
      } else {
        cy.expectLightTheme();
      }
    });

    cy.findByRole('button', { name: /switch theme/i }).click();

    // Value gets updated on button click
    cy.get<boolean>('@isDarkTheme').then(isDarkTheme => {
      if (isDarkTheme) {
        cy.expectDarkTheme();
      } else {
        cy.expectLightTheme();
      }
    });
  });
});
