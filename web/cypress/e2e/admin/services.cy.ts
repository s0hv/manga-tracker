import { adminUser } from '../../../__tests__/constants';
import { Selector } from '../../selectors';

function validateEditPersisted() {
  cy.findByRole('checkbox').should('be.checked').and('be.disabled');
  cy.get('td')
    .eq(4)
    .invoke('text')
    .should('match', /^Oct 10th, 00:00 - \d years ago$/i);
}

function validateEditNotPersisted() {
  cy.findByRole('checkbox').should('not.be.checked').and('be.disabled');
  cy.get('td').eq(4).should('have.text', 'ASAP');
}

describe('Services page', () => {
  beforeEach(() => {
    cy.task('runSql', {
      sql: 'UPDATE services SET disabled = FALSE WHERE service_id=1;'
        + 'UPDATE service_whole SET next_update = NULL WHERE service_id=1',
    });
  });

  it('should allow editing services', () => {
    cy.login(adminUser);

    Selector.getUserMenuBtn().click();
    Selector.getServicesLink().click();

    cy.findByRole('cell', { name: 'MANGA Plus' })
      .closest('tr')
      .as('row', { type: 'query' });

    cy.get('@row').within(() => {
      validateEditNotPersisted();
      Selector.getEditRowBtn().click();

      cy.findAllByRole('textbox').should('have.length', 0);
      cy.findByRole('group').type('101020200000');
      cy.findByRole('checkbox').click();
      Selector.getSaveRowBtn().click();
    });

    Selector.assertAlertExists(/^Service edited successfully$/i);

    // Validate that the information was changed and persisted even after a reload
    cy.get('@row').within(() => {
      validateEditPersisted();
    });

    cy.reload();

    cy.get('@row').within(() => {
      validateEditPersisted();
    });
  });

  it('should not save when clicking cancel', () => {
    cy.login(adminUser);

    Selector.getUserMenuBtn().click();
    Selector.getServicesLink().click();

    cy.findByRole('cell', { name: 'MANGA Plus' })
      .closest('tr')
      .as('row', { type: 'query' });

    cy.get('@row').within(() => {
      validateEditNotPersisted();
      Selector.getEditRowBtn().click();

      cy.findAllByRole('textbox').should('have.length', 0);
      cy.findByRole('group').type('101020200000');
      cy.findByRole('checkbox').click();
      Selector.getCancelRowSaveBtn().click();
    });


    // Validate that the information was changed and persisted even after a reload
    cy.get('@row').within(() => {
      validateEditNotPersisted();
    });

    cy.reload();

    cy.get('@row').within(() => {
      validateEditNotPersisted();
    });
  });
});
