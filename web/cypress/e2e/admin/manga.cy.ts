import { adminUser } from '../../../__tests__/constants';
import { Selector } from '../../selectors';
import {
  assertTableRowValues,
  getTableRowByColumnValue,
} from '../../utilities';

const testTitleId = 'test-title-id';

function deleteTempMangaService() {
  return cy.task('runSql', {
    sql: `DELETE FROM manga_service WHERE service_id=8 AND title_id='${testTitleId}'`,
  });
}

describe('Manga admin page', () => {
  beforeEach(() => {
    deleteTempMangaService();

    cy.task('runSql', {
      sql: 'UPDATE manga_info SET status = 0 WHERE manga_id=1;\n'
        + "UPDATE manga SET title = 'Dr. Stone' WHERE manga_id=1;\n"
        + "UPDATE manga_alias SET title = 'Test alias' WHERE manga_id=1;\n"
        + "UPDATE manga_service SET disabled = FALSE, next_update='2020-08-10 16:00:00.000000 +00:00'::timestamptz WHERE manga_id=1 AND service_id=1;\n"
        + 'DELETE FROM scheduled_runs WHERE manga_id=1',
    });

    cy.login(adminUser);

    cy.visit('/manga/1');
    cy.wait(200);
    Selector.getMangaAdminPageBtn().click();
  });

  after(() => {
    deleteTempMangaService();
  });

  it('should allow editing manga info', () => {
    // Try updating publication status
    Selector.getPublicationStatusSelect().should('have.text', 'Ongoing');
    Selector.getPublicationStatusSelect().click();
    cy.findByRole('option', { name: 'Completed' }).click();
    cy.findByRole('button', { name: /^save changes$/i }).click();
    Selector.assertAlertExists(/^manga info updated$/i);

    // Try changing title
    cy.findByRole('listitem').within(() => {
      cy.findByText('Test alias').should('exist');
      cy.findByRole('button', { name: /^set alias as main title$/i }).click();
    });

    cy.findByText('Do you want to set "Test alias" as the main title for this manga?').should('exist');
    Selector.getYesBtn().click();
    Selector.assertAlertExists(/^Set "Test alias" as the main title. Replaced old alias with current title "Dr\. STONE"$/i);

    cy.reload();

    cy.findByRole('heading', { name: /^test alias$/i }).should('exist');
    Selector.getPublicationStatusSelect().should('have.text', 'Completed');
  });

  it('should allow editing manga services', () => {
    Selector.getMangaServicesTable().within(() => {
      Selector.getEditRowBtn(0).click();
      cy.findAllByRole('textbox').should('have.length', 0);

      cy.findByRole('checkbox', { name: /^disabled$/i }).click();
      cy.findByRole('group', { name: /^next update$/i }).type('010120260000');

      Selector.getSaveRowBtn().click();
    });

    Selector.assertAlertExists(/^Updated manga service$/i);

    cy.reload();

    Selector.getMangaServicesTable().within(() => {
      cy.findAllByRole('row').should('have.length', 3);
      cy.findAllByRole('row').eq(1)
        .findAllByRole('cell').eq(5)
        .should('have.text', 'Jan 1st 2026, 00:00');
    });

    Selector.getMangaServicesTable().within(() => {
      Selector.getEditRowBtn(0).click();
      Selector.getSaveRowBtn().click();
    });

    cy.wait(50);
    cy.findByRole('alert').should('not.exist');
  });

  it('should allow creating a new manga service', () => {
    cy.findByRole('button', { name: 'create manga service' }).click();
    cy.findByRole('heading', { name: 'Create row' });

    const serviceName = 'Comikey';

    cy.selectComboboxValue('Service', serviceName);
    cy.findByRole('textbox', { name: 'Title id' })
      .type(testTitleId);
    Selector.getCreateRowBtn().click();
    Selector.assertAlertExists('Successfully create a new manga service');

    getTableRowByColumnValue({
      tableName: /^manga services$/i,
      column: 'Service',
      value: serviceName,
    });

    cy.reload();

    // Assert that the new manga service was persisted
    assertTableRowValues(
      /^manga services$/i,
      {
        Service: serviceName,
        'Title id': testTitleId,
        'Last check': 'Unknown',
        'Next update': 'Unknown',
        Disabled: row => cy.wrap(row).findByRole('checkbox').should('not.be.checked'),
      } as const,
      'Service'
    );

    const searchParams = new URLSearchParams({
      query: 'Dr. stone',
      withServices: 'true',
    });

    // Wait for changes to persist
    cy.wait(100);

    // Make sure that elasticsearch was updated after new service was created
    cy.request(`/api/quicksearch?${searchParams.toString()}`)
      .then(async res => {
        cy.log('response body', JSON.stringify(res.body, undefined, 2));
        return res;
      })
      .its('body.0.services.8').should('eq', serviceName);
  });

  it('should allow adding and deleting scheduled runs', () => {
    // MangaDex scheduled run should get added automatically
    Selector.getScheduledRunsTable().within(() => {
      cy.findAllByRole('row').eq(1)
        .findAllByRole('cell').eq(0)
        .should('have.text', 'MangaDex');
    });

    // Try to add an existing scheduled run
    Selector.getAddScheduledRunBtn().click();
    cy.selectComboboxValue('Service', 'MangaDex');
    Selector.getCreateRowBtn().click();
    Selector.assertAlertExists(/^resource already exists$/i);

    // Try to add a new scheduled run
    Selector.getAddScheduledRunBtn().click();
    cy.selectComboboxValue('Service', 'MANGA Plus');
    Selector.getCreateRowBtn().click();
    Selector.assertAlertExists(/^Successfully scheduled manga 1 to be checked on service 1$/i);

    // Delete the scheduled run
    Selector.getScheduledRunsTable()
      .findAllByRole('row').eq(2)
      .findByRole('button', { name: /^delete row$/i }).click();

    cy.findByText(/^Do you want to delete row/i).should('exist');
    Selector.getDeleteRowBtn().click();
    Selector.assertAlertExists(/^Successfully deleted service MANGA Plus from scheduled runs$/i);

    cy.reload();

    Selector.getScheduledRunsTable()
      .findAllByRole('row')
      .should('have.length', 2);
  });
});
