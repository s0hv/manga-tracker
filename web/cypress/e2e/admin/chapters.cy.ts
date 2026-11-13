import { adminUser } from '../../../__tests__/constants';
import { Selector } from '../../selectors';
import {
  assertTableRowValues,
  deleteChaptersByIdentifierPrefix,
  getTableRowByColumnValue,
} from '../../utilities';

const mangaId = 1;
const serviceId = 1;
const identifierPrefix = 'cy-edit-chapter';
const chapterTitle = 'Cypress chapter number edit';
const chaptersTable = 'Manga chapters';

function createTestChapter() {
  // A release date in the future keeps the chapter on the first page of the chapter list.
  // The identifier must match identifierPrefix so deleteChaptersByIdentifierPrefix can remove it.
  return cy.task('runSql', {
    sql: `INSERT INTO chapters
            (manga_id, service_id, title, chapter_number, chapter_decimal, release_date, chapter_identifier, group_id)
          VALUES (${mangaId}, ${serviceId}, '${chapterTitle}', 9000, NULL, NOW() + INTERVAL '1 day', '${identifierPrefix}-0', 1)`,
  });
}

function editChapterNumber(value: string) {
  getTableRowByColumnValue({
    tableName: chaptersTable,
    column: 'Title',
    value: chapterTitle,
  })
    .closest('tr')
    .within(() => {
      cy.findByRole('button', { name: /^edit row$/i }).click();
      cy.findByRole('textbox', { name: /^chapter number$/i })
        .clear()
        .type(value);
      Selector.getSaveRowBtn().click();
    });
}

describe('Chapter editing', () => {
  beforeEach(() => {
    deleteChaptersByIdentifierPrefix(serviceId, identifierPrefix);
    createTestChapter();

    cy.login(adminUser);
    cy.visit(`/manga/${mangaId}`);
    Selector.getEditChaptersBtn().click();
  });

  after(() => {
    deleteChaptersByIdentifierPrefix(serviceId, identifierPrefix);
  });

  it('should allow editing the chapter number', () => {
    editChapterNumber('9001.5');

    Selector.assertAlertExists(/^Successfully updated chapter \d+$/i);
    // The row leaves edit mode only after the update succeeds
    cy.findByRole('textbox', { name: /^chapter number$/i }).should('not.exist');

    cy.reload();

    assertTableRowValues(
      chaptersTable,
      {
        Title: chapterTitle,
        'Ch.': '9001.5',
      } as const,
      'Title'
    );
  });

  it('should allow removing the chapter decimal', () => {
    cy.task('runSql', {
      sql: `UPDATE chapters SET chapter_decimal = 5 WHERE chapter_identifier = '${identifierPrefix}-0'`,
    });
    cy.reload();
    Selector.getEditChaptersBtn().click();

    editChapterNumber('9002');

    Selector.assertAlertExists(/^Successfully updated chapter \d+$/i);

    cy.reload();

    assertTableRowValues(
      chaptersTable,
      {
        Title: chapterTitle,
        'Ch.': '9002',
      } as const,
      'Title'
    );
  });

  it('should keep the row in edit mode when the update fails', () => {
    editChapterNumber('abc');

    Selector.assertAlertExists(/chapterNumber/i);
    cy.findByRole('textbox', { name: /^chapter number$/i }).should('exist');
  });
});
