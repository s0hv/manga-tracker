import { MANGA4, mangaTitle } from '../constants';
import { Selector } from '../selectors';

const expectSearchPageWithQuery = (query: string) => {
  cy.location('pathname').should('equal', '/manga/search');
  cy.location('search').should(search => {
    expect(new URLSearchParams(search).get('query')).to.equal(query);
  });
};

const visitSearchPage = (query: string) => cy.visit('/manga/search', { qs: { query }});

describe('Manga search', () => {
  beforeEach(() => {
    // The manga admin tests change the publication status
    cy.task('runSql', { sql: 'UPDATE manga_info SET status = 0 WHERE manga_id=1' });
  });

  describe('from the top bar', () => {
    beforeEach(() => {
      cy.visit('/');
    });

    it('opens the search page when pressing enter', () => {
      Selector.getMangaSearchInput().click().type(`${mangaTitle}{enter}`);

      expectSearchPageWithQuery(mangaTitle);
      Selector.getSearchPageHeading().should('exist');
      Selector.getSearchResultCountText(mangaTitle).should('exist');
      Selector.getSearchPageInput().should('have.value', mangaTitle);
      // Both the cover and the title link to the manga
      Selector.getSearchResultLinks(mangaTitle).should('have.length', 2);

      // The query is kept in the top bar search, but the quick search results are closed
      Selector.getMangaSearchInput()
        .should('have.value', mangaTitle)
        .and('not.have.focus');
      cy.findByRole('listbox').should('not.exist');
    });

    it('opens the search page when clicking the search button', () => {
      Selector.getMangaSearchInput().click().type(mangaTitle);
      Selector.getMangaSearchBtn().click();

      expectSearchPageWithQuery(mangaTitle);
      Selector.getSearchResultCountText(mangaTitle).should('exist');
    });

    it('does not open the search page with a too short query', () => {
      Selector.getMangaSearchInput().click().type('a{enter}');
      Selector.getMangaSearchBtn().click();

      // Wait for a possible navigation
      cy.wait(200);
      cy.location('pathname').should('equal', '/');
    });

    it('opens the manga page when clicking a quick search option', () => {
      Selector.getMangaSearchInput().click().type(mangaTitle);
      cy.findByRole('listbox').within(() => {
        cy.findByRole('option', { name: mangaTitle }).click();
      });

      cy.location('pathname').should('equal', '/manga/1');
    });

    it('opens the manga page when selecting a quick search option with the keyboard', () => {
      Selector.getMangaSearchInput().click().type(mangaTitle);
      cy.findByRole('listbox').within(() => {
        cy.findByRole('option', { name: mangaTitle }).should('exist');
      });

      Selector.getMangaSearchInput().type('{downArrow}{enter}');

      cy.location('pathname').should('equal', '/manga/1');
    });
  });

  describe('on the search page', () => {
    it('opens the manga page when clicking a result', () => {
      visitSearchPage(mangaTitle);

      Selector.getSearchResultLinks(mangaTitle).last().click();

      cy.location('pathname').should('equal', '/manga/1');
      cy.findByRole('heading', { name: mangaTitle }).should('exist');
    });

    it('searches with the query typed into the search field', () => {
      visitSearchPage(mangaTitle);
      Selector.getSearchResultCountText(mangaTitle).should('exist');

      Selector.getSearchPageInput().clear().type(`${MANGA4.title}{enter}`);

      expectSearchPageWithQuery(MANGA4.title);
      Selector.getSearchResultCountText(MANGA4.title).should('exist');
      Selector.getSearchResultLinks(MANGA4.title).should('exist');

      // Going back restores the previous search
      cy.go('back');

      expectSearchPageWithQuery(mangaTitle);
      Selector.getSearchResultCountText(mangaTitle).should('exist');
      Selector.getSearchPageInput().should('have.value', mangaTitle);
      Selector.getSearchResultLinks(mangaTitle).should('exist');
    });

    it('searches again when searching from the top bar', () => {
      visitSearchPage(mangaTitle);
      Selector.getSearchResultCountText(mangaTitle).should('exist');

      Selector.getMangaSearchInput().click().clear().type(`${MANGA4.title}{enter}`);

      expectSearchPageWithQuery(MANGA4.title);
      Selector.getSearchResultCountText(MANGA4.title).should('exist');
      Selector.getSearchPageInput().should('have.value', MANGA4.title);
      Selector.getSearchResultLinks(MANGA4.title).should('exist');
    });

    it('filters the results by publication status', () => {
      visitSearchPage(mangaTitle);
      Selector.getSearchResultLinks(mangaTitle).should('exist');

      Selector.getSearchFilterCheckbox('Completed').click();
      Selector.getSearchResultLinks(mangaTitle).should('not.exist');

      Selector.getSearchFilterCheckbox('Completed').click();
      Selector.getSearchFilterCheckbox('Ongoing').click();
      Selector.getSearchResultLinks(mangaTitle).should('exist');
    });

    it('filters the results by the services of the found manga', () => {
      visitSearchPage(mangaTitle);
      Selector.getSearchResultLinks(mangaTitle).should('exist');

      Selector.getSearchFilterCheckbox('MANGA Plus').should('exist');
      Selector.getSearchFilterCheckbox('MangaDex').click();

      Selector.getSearchResultLinks(mangaTitle).should('exist');
      // The other service filters stay available while filtering
      Selector.getSearchFilterCheckbox('MANGA Plus').should('exist');
      Selector.getSearchEndText().should('exist');
    });
  });
});
