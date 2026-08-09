import type { ChapterFail } from '@/types/db/chapterFail';

import { adminUser } from '../../../__tests__/constants';
import { mangaTitle } from '../../constants';
import { Selector } from '../../selectors';
import {
  assertTableRowValues,
  getTableRowByColumnValue,
} from '../../utilities';

const tableName = 'Chapters that could not be parsed';

type ChapterFailString = {
  [K in keyof Omit<ChapterFail, 'timestamp'>]: ChapterFail[K] extends Date
    ? string
    : ChapterFail[K]
} & {
  serviceName: string
  releaseDateDb?: string
};

// Row that has every optional field populated, including an existing manga
// and a group that does not exist yet (it should get created when fixed).
const fullFail = {
  chapterIdentifier: 'cy-parsing-fail-full',
  serviceId: 1,
  serviceName: 'MANGA Plus',
  mangaId: 1,
  errors: 'Cypress test parsing error',
  title: 'Cypress Original Chapter Title',
  chapterNumber: 12,
  chapterDecimal: null,
  titleId: 'cy-title-999',
  mangaTitle: 'Cypress Cached Manga Title',
  releaseDate: 'Mar 4th 2021, 00:00',
  releaseDateDb: '2021-03-04',
  group: 'Cypress Test Group',
} satisfies ChapterFailString;

// Row where every optional field is empty
const emptyFail: Partial<ChapterFailString> = {
  chapterIdentifier: 'cy-parsing-fail-empty',
  serviceId: 2,
  serviceName: 'MangaDex',
  errors: 'Cypress test parsing error empty',
  releaseDate: 'Unknown',
};

// Values used to manually fill in every field of the create chapter form
// when fixing `emptyFail`.
const emptyFailFix = {
  title: 'Cypress Fixed Empty Chapter Title',
  chapterNumber: 7,
  releaseDate: { day: '04', month: '03', year: '2021', hours: '12', minutes: '00' },
  group: 'Cypress Empty Fix Group',
};

function getRowByChapterIdentifier(chapterIdentifier: string, expectedRows?: 'none' | 'one' | 'many') {
  const chainable = getTableRowByColumnValue({
    tableName,
    column: 'Chapter identifier',
    value: chapterIdentifier,
    expectedRows,
  });

  if (expectedRows === 'none') {
    return chainable;
  }

  return chainable.closest('tr');
}

function assertChapterFailTableValues(chapterFail: Partial<ChapterFailString>) {
  return assertTableRowValues(
    tableName,
    {
      'Chapter identifier': chapterFail.chapterIdentifier,
      Service: chapterFail.serviceName,
      Error: chapterFail.errors,
      'Title ID': (row, index) => {
        const chain = cy.wrap(row.find('td').eq(index))
          .should('have.text', chapterFail.titleId ?? '');

        return chapterFail.titleId
          ? chain
            .findByRole('link')
            .should('have.attr', 'href', `https://mangaplus.shueisha.co.jp/titles/${fullFail.titleId}`)
          : chain;
      },
      'Manga title': chapterFail.mangaTitle ?? '',
      'Release date': chapterFail.releaseDate ?? '',
      Group: chapterFail.group ?? '',
    },
    'Chapter identifier'
  );
}

function insertTestData() {
  return cy.task('runSql', {
    sql: `
      INSERT INTO chapters_failed
        (chapter_identifier, service_id, manga_id, errors, title, chapter_number,
         chapter_decimal, title_id, manga_title, release_date, "group", timestamp)
      VALUES
        ('${fullFail.chapterIdentifier}', ${fullFail.serviceId}, ${fullFail.mangaId},
         '${fullFail.errors}', '${fullFail.title}', ${fullFail.chapterNumber},
         NULL, '${fullFail.titleId}', '${fullFail.mangaTitle}', '${fullFail.releaseDateDb}',
         '${fullFail.group}', '2021-03-04 12:00:00+00'),

        ('${emptyFail.chapterIdentifier}', ${emptyFail.serviceId}, NULL,
         '${emptyFail.errors}', NULL, NULL,
         NULL, NULL, NULL, NULL,
         NULL, '2021-03-04 11:00:00+00');
    `,
  });
}

// Cleans up everything the tests in this file could have created: the two
// chapters_failed rows themselves, any chapter created by fixing a failed
// row, and the groups that get auto-created for `fullFail.group` and
// `emptyFailFix.group`.
function cleanupTestData() {
  return cy.task('runSql', {
    sql: `
      DELETE FROM chapters WHERE (service_id, chapter_identifier) IN (
        (${fullFail.serviceId}, '${fullFail.chapterIdentifier}'),
        (${emptyFail.serviceId}, '${emptyFail.chapterIdentifier}')
      );
      DELETE FROM groups WHERE name IN ('${fullFail.group}', '${emptyFailFix.group}');
      DELETE FROM chapters_failed WHERE (service_id, chapter_identifier) IN (
        (${fullFail.serviceId}, '${fullFail.chapterIdentifier}'),
        (${emptyFail.serviceId}, '${emptyFail.chapterIdentifier}')
      );
    `,
  });
}

describe('Chapter parsing fails page', () => {
  beforeEach(() => {
    cleanupTestData();
    insertTestData();

    cy.login(adminUser);

    Selector.getUserMenuBtn().click();
    Selector.getParsingFailsLink().click();
  });

  after(() => {
    cleanupTestData();
  });

  it('should list chapters that failed to parse', () => {
    assertChapterFailTableValues(fullFail);
    assertChapterFailTableValues(emptyFail);
  });

  it('should allow deleting a chapter fail', () => {
    getRowByChapterIdentifier(emptyFail.chapterIdentifier).within(() => {
      Selector.getDeleteChapterFailBtn().click();
    });

    cy.findByText(/^Are you sure you want to delete this chapter fail\?$/i).should('exist');
    Selector.getDeleteBtn().click();

    getRowByChapterIdentifier(emptyFail.chapterIdentifier, 'none');

    cy.reload();

    getRowByChapterIdentifier(emptyFail.chapterIdentifier, 'none');
  });

  it('should not delete a chapter fail when canceling the confirmation', () => {
    getRowByChapterIdentifier(fullFail.chapterIdentifier).within(() => {
      Selector.getDeleteChapterFailBtn().click();
    });

    cy.findByText(/^Are you sure you want to delete this chapter fail\?$/i).should('exist');
    Selector.getCancelBtn().click();

    getRowByChapterIdentifier(fullFail.chapterIdentifier, 'one');
  });

  it('should allow fixing a chapter fail by creating the chapter', () => {
    getRowByChapterIdentifier(fullFail.chapterIdentifier).within(() => {
      Selector.getFixChapterFailBtn().click();
    });

    Selector.getCreateChapterForm().within(() => {
      cy.findByRole('textbox', { name: 'Chapter Identifier' }).should('have.value', fullFail.chapterIdentifier);

      cy.findByRole('textbox', { name: 'Chapter title' })
        .clear()
        .type('Cypress Fixed Chapter Title');

      Selector.getCreateRowBtn().click();
    });

    Selector.assertAlertExists(/^Chapter added successfully$/i);

    getRowByChapterIdentifier(fullFail.chapterIdentifier, 'none');

    cy.task('runSql', {
      sql: `SELECT title, chapter_number, group_id FROM chapters
            WHERE service_id = ${fullFail.serviceId} AND chapter_identifier = '${fullFail.chapterIdentifier}'`,
    }).then(rows => {
      expect(rows).to.have.length(1);
      expect((rows as any)[0].title).to.equal('Cypress Fixed Chapter Title');
      expect((rows as any)[0].chapterNumber).to.equal(fullFail.chapterNumber);
    });

    cy.task('runSql', {
      sql: `SELECT 1 FROM groups WHERE name = '${fullFail.group}'`,
    }).then(rows => {
      expect(rows).to.have.length(1);
    });
  });

  it('should allow fixing a chapter fail with no data by filling in every field', () => {
    getRowByChapterIdentifier(emptyFail.chapterIdentifier).within(() => {
      Selector.getFixChapterFailBtn().click();
    });

    Selector.getCreateChapterForm().within(() => {
      cy.findByRole('textbox', { name: 'Chapter Identifier' }).should('have.value', emptyFail.chapterIdentifier);

      cy.findByRole('textbox', { name: 'Chapter title' })
        .type(emptyFailFix.title);

      cy.findByRole('spinbutton', { name: 'Chapter number' })
        .type(String(emptyFailFix.chapterNumber));

      cy.findByRole('group', { name: /release date/i }).within(() => {
        cy.findByRole('spinbutton', { name: 'Day' }).type(emptyFailFix.releaseDate.day);
        cy.findByRole('spinbutton', { name: 'Month' }).type(emptyFailFix.releaseDate.month);
        cy.findByRole('spinbutton', { name: 'Year' }).type(emptyFailFix.releaseDate.year);
        cy.findByRole('spinbutton', { name: 'Hours' }).type(emptyFailFix.releaseDate.hours);
        cy.findByRole('spinbutton', { name: 'Minutes' }).type(emptyFailFix.releaseDate.minutes);
      });

      cy.findByRole('combobox', { name: 'Group' }).type(emptyFailFix.group);

      cy.findByRole('combobox', { name: 'Manga' }).type(mangaTitle);
    });

    cy.findByRole('option', { name: /dr\. stone/i }).click();
    Selector.getCreateRowBtn().click();
    Selector.assertAlertExists(/^Chapter added successfully$/i);

    getRowByChapterIdentifier(emptyFail.chapterIdentifier, 'none');

    cy.task('runSql', {
      sql: `SELECT title, chapter_number, manga_id, group_id FROM chapters
            WHERE service_id = ${emptyFail.serviceId} AND chapter_identifier = '${emptyFail.chapterIdentifier}'`,
    }).then((rows: Record<string, unknown>[]) => {
      expect(rows).to.have.length(1);
      expect(rows[0].title).to.equal(emptyFailFix.title);
      expect(rows[0].chapterNumber).to.equal(emptyFailFix.chapterNumber);
      expect(rows[0].mangaId).to.equal(1);
    });

    cy.task('runSql', {
      sql: `SELECT 1 FROM groups WHERE name = '${emptyFailFix.group}'`,
    }).then(rows => {
      expect(rows).to.have.length(1);
    });
  });

  it('should not create a chapter when canceling the fix dialog', () => {
    getRowByChapterIdentifier(fullFail.chapterIdentifier).within(() => {
      Selector.getFixChapterFailBtn().click();
    });

    Selector.getCreateChapterForm().within(() => {
      Selector.getCancelBtn().click();
    });

    Selector.getCreateChapterForm().should('not.exist');

    getRowByChapterIdentifier(fullFail.chapterIdentifier, 'one');

    // Wait a moment to make sure the chapter was not created.
    cy.wait(100);

    cy.task('runSql', {
      sql: `SELECT 1 FROM chapters
            WHERE service_id = ${fullFail.serviceId} AND chapter_identifier = '${fullFail.chapterIdentifier}'`,
    }).then(rows => {
      expect(rows).to.have.length(0);
    });
  });
});
