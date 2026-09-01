import { normalUser } from '../../__tests__/constants';
import { MANGA4, mangaTitle } from '../constants';
import { Selector } from '../selectors';
import { createChapters, deleteChaptersByIdentifierPrefix } from '../utilities';

describe('Frontpage', () => {
  describe('when not logged in', () => {
    it('shows the recent releases list without follow tabs', () => {
      cy.visit('/');

      Selector.getRecentReleasesHeading().should('exist');
      Selector.getChapterAndSeriesCountText().should('exist');

      // Tabs for switching between all releases and follows are only shown
      // to authenticated users
      Selector.getAllReleasesTab().should('not.exist');
      Selector.getMyFollowsTab().should('not.exist');

      Selector.getOpenChapterBtns().should('have.length', 3);
    });
  });

  describe('when logged in', () => {
    beforeEach(() => {
      cy.login(normalUser);
      cy.visit('/');
    });

    it('defaults to the My follows tab and shows followed series', () => {
      Selector.getRecentReleasesHeading().should('exist');
      Selector.getChapterAndSeriesCountText().should('exist');

      Selector.getMyFollowsTab().should('have.attr', 'aria-selected', 'true');
      Selector.getAllReleasesTab().should('have.attr', 'aria-selected', 'false');

      Selector.getMangaCoverImage(mangaTitle).should('exist');
    });

    it('can switch between the All releases and My follows tabs', () => {
      // Wait for scripts to load
      cy.wait(100);
      Selector.getMyFollowsTab().should('have.attr', 'aria-selected', 'true');

      Selector.getAllReleasesTab().click();

      Selector.getAllReleasesTab().should('have.attr', 'aria-selected', 'true');
      Selector.getMyFollowsTab().should('have.attr', 'aria-selected', 'false');
      Selector.getChapterAndSeriesCountText().should('exist');
      Selector.getOpenChapterBtns().should('have.length', 3);

      Selector.getMyFollowsTab().click();

      Selector.getMyFollowsTab().should('have.attr', 'aria-selected', 'true');
      Selector.getAllReleasesTab().should('have.attr', 'aria-selected', 'false');
      Selector.getMangaCoverImage(mangaTitle).should('exist');
    });
  });

  describe('chapter list interactions', () => {
    it('can show all chapters of a series and collapse the list again', () => {
      cy.visit('/');

      Selector.getOpenChapterBtns().should('have.length', 3);
      Selector.getShowAllChaptersBtns().first().click();
      Selector.getOpenChapterBtns().should('have.length', 10);
      Selector.getShowFewerChaptersBtn().click();
      Selector.getOpenChapterBtns().should('have.length', 3);
    });
  });

  describe('loading more chapters', () => {
    const identifierPrefix = 'cy-load-more';
    const serviceId = MANGA4.serviceId;

    // Create enough chapters so there is another page to load
    beforeEach(() => {
      createChapters({
        mangaId: MANGA4.id,
        serviceId,
        count: 20,
        latestReleaseDate: new Date('2020-05-20T00:00:00.000Z'),
        intervalMinutes: 60 * 24,
        identifierPrefix,
      });
    });

    afterEach(() => {
      deleteChaptersByIdentifierPrefix(serviceId, identifierPrefix);
    });

    it('fetches and shows older chapters when clicking the load more button', () => {
      cy.visit('/');

      Selector.getChapterAndSeriesCountText()
        .invoke('text')
        .should('equal', '15 chapters · 2 series');

      Selector.getSeriesHeading(MANGA4.title)
        .parent()
        .findAllByRole('paragraph')
        .should('have.text', '5 chapters');

      Selector.getLoadMoreChaptersBtn().click();

      Selector.getChapterAndSeriesCountText()
        .invoke('text')
        .should('equal', '30 chapters · 2 series');

      Selector.getSeriesHeading(MANGA4.title)
        .parent()
        .findAllByRole('paragraph')
        .should('have.text', '20 chapters');

      Selector.getLoadMoreChaptersBtn().click();
      Selector.getLoadMoreChaptersBtn().should('not.exist');
      Selector.getLastPageBtn().should('be.disabled');
    });
  });
});
