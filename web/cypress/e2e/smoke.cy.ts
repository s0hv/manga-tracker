import { adminUser, normalUser } from '../../__tests__/constants';
import { mangaTitle } from '../constants';
import { Selector } from '../selectors';
import { getTableRowByColumnValue } from '../utilities';

describe('Smoke tests', () => {
  it('Pages load for non-logged in users', () => {
    cy.visit('/');

    Selector.getLogoLink().should('exist');
    Selector.getFollowsText(false).should('exist');
    Selector.getRecentReleaseHeader(mangaTitle);

    Selector.getMangaSearchInput().click().type(mangaTitle);
    cy.findByRole('listbox').within(() => {
      cy.findByRole('option', { name: mangaTitle }).click();
    });

    cy.location('pathname').should('equal', '/manga/1');

    cy.findByRole('heading', { name: mangaTitle }).should('exist');
    Selector.getMangaCoverImage(mangaTitle).should('exist');

    Selector.getStatsTab().click();
    // Changing to the stats page should keep the main page loaded
    cy.findByRole('heading', { name: mangaTitle, timeout: 1 }).should('exist');

    cy.findByRole('tabpanel').within(() => {
      cy.findByText('Release frequency').should('exist');
    });

    Selector.getChaptersTab().click();

    getTableRowByColumnValue({
      column: 'Service',
      value: 'MANGA Plus',
      tableName: 'Manga chapters',
      expectedRows: 'many',
    });

    getTableRowByColumnValue({
      column: 'Service',
      value: 'MangaDex',
      tableName: 'Manga chapters',
      expectedRows: 'one',
    });

    Selector.getFilterServicesElement().click();
    Selector.getFilterServicesElement('listbox').within(() => {
      cy.findByRole('option', { name: 'MANGA Plus' }).click();
    });

    getTableRowByColumnValue({
      column: 'Service',
      value: 'MANGA Plus',
      tableName: 'Manga chapters',
      expectedRows: 'none',
    });

    getTableRowByColumnValue({
      column: 'Service',
      value: 'MangaDex',
      tableName: 'Manga chapters',
      expectedRows: 'one',
    });
  });

  it('Pages load for logged in users', () => {
    cy.login(normalUser);

    Selector.getUserMenuBtn().click();
    Selector.getProfileLink().click();

    cy.findByRole('textbox', { name: /^username$/i }).should('exist');
    cy.findByRole('button', { name: /^update profile$/i }).should('exist');

    Selector.getUserMenuBtn().click();
    Selector.getFollowsLink().click();

    cy.findByRole('heading', { name: /^follows$/i }).should('exist');
    cy.findByRole('heading', { name: mangaTitle }).should('exist');

    Selector.getUserMenuBtn().click();
    Selector.getNotificationsLink().click();

    Selector.getCreateNotificationBtn().should('be.disabled');
  });

  it('Pages load for admin users', () => {
    cy.login(adminUser);

    // Services page
    Selector.getUserMenuBtn().click();
    Selector.getServicesLink().click();

    cy.findByRole('table', { name: /^services$/i })
      .within(() => {
        cy.findAllByRole('row').should('have.length.greaterThan', 10);
      });

    // Manga admin page
    Selector.getMangaSearchInput().click().type(mangaTitle);
    cy.findByRole('listbox').within(() => {
      cy.findByRole('option', { name: mangaTitle }).click();
    });

    cy.location('pathname').should('equal', '/manga/1');

    Selector.getEditChaptersBtn().click();

    cy.findAllByRole('button', { name: /^edit row$/i })
      .should('have.length.greaterThan', 3)
      .eq(0)
      .click()
      .closest('tr')
      .within(() => {
        cy.findByRole('textbox').should('have.value', 'Z=143: Ryusui vs. Senku');
      });

    cy.findByRole('button', { name: /^save row$/i }).should('exist');
    cy.findByRole('button', { name: /^cancel edit$/i }).should('exist').click();
    cy.findByRole('textbox').should('not.exist');

    cy.findAllByRole('button', { name: /^delete row$/i })
      .should('have.length.greaterThan', 3)
      .eq(0)
      .click();

    cy.findByRole('dialog', { name: /^are you sure\?$/i }).should('exist');
    cy.findByRole('button', { name: /^cancel$/i }).click();

    Selector.getEditChaptersBtn().click();
    cy.findByRole('button', { name: /^delete row$/i }).should('not.exist');

    // Manga admin page
    cy.findByRole('button', { name: /^admin page$/i }).click();
    cy.location('pathname').should('equal', '/admin/manga/1');

    cy.findByText('Alternative titles').should('exist');
    cy.findByRole('table', { name: /^manga services$/i }).should('exist');
    cy.findByRole('table', { name: /^scheduled runs$/i }).should('exist');

    cy.findByRole('button', { name: /^add item$/i }).should('exist');
    cy.findByRole('button', { name: /^add scheduled run$/i }).should('exist');
    cy.findByRole('combobox', { name: /^publication status$/i }).should('exist');

    // Merge manga page
    cy.visit('/admin/manga/merge');

    cy.findByRole('combobox', { name: /^search base manga$/i }).should('exist');
    cy.findByRole('combobox', { name: /^search manga to merge$/i }).should('exist');
  });

  it('Loads static pages', () => {
    cy.login(normalUser);

    Selector.getUserMenuBtn().should('exist');

    cy.findByRole('link', { name: /^Third party notices$/i }).click();
    cy.findByRole('heading', { name: 'Third party notices' }).should('exist');

    cy.go('back');
    Selector.getUserMenuBtn().should('exist');

    cy.findByRole('link', { name: /^Privacy policy$/i }).click();
    cy.findByRole('heading', { name: 'Privacy Policy' }).should('exist');

    cy.go('back');
    Selector.getUserMenuBtn().should('exist');

    cy.findByRole('link', { name: /^Terms$/i }).click();
    cy.findByRole('heading', { name: 'TERMS OF SERVICE' }).should('exist');

    cy.go('back');
    Selector.getUserMenuBtn().should('exist');
  });
});
