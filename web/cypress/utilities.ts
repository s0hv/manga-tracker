export type RowByColumnParams = {
  column: string | RegExp
  value: string
  tableName?: string | RegExp
  expectedRows?: 'none' | 'one' | 'many'
};

export function getTableRowByColumnValue({
  column,
  value,
  tableName,
  expectedRows = 'one',
}: RowByColumnParams) {
  const getTable = () => cy.findByRole('table', { name: tableName });

  getTable()
    .should('have.attr', 'data-isloading')
    .and('not.equal', 'true');

  getTable()
    .within(() => {
      cy.findByRole('columnheader', { name: column }).as('columnHeader');
    });

  return cy.get('@columnHeader')
    .then(header => {
      const headerElem = header.get(0);
      let headerIndex = 0;
      let node: Element = headerElem;

      while (node.previousElementSibling) {
        node = node.previousElementSibling;
        headerIndex++;
      }

      const rows = header.closest('table')
        .find('tbody > tr')
        .find(`td:eq(${headerIndex})`)
        .filter((_, elem) => elem.textContent === value);

      switch (expectedRows) {
        case 'none':
          expect(rows.length).to.equal(0);
          break;

        case 'many':
          expect(rows.length).to.be.greaterThan(0);
          break;

        default:
          expect(rows.length).to.equal(1);
      }

      return rows;
    });
}

