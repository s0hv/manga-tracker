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

type RowAssertion = (row: JQuery<HTMLTableRowElement>, columnIndex: number) => unknown;

export function assertTableRowValues<TValues extends Record<string, string | RowAssertion>>(
  tableName: string | RegExp,
  columnValues: TValues,
  identifyingColumn: keyof TValues
) {
  const getTable = () => cy.findByRole('table', { name: tableName });

  getTable()
    .should('have.attr', 'data-isloading')
    .and('not.equal', 'true');

  getTable()
    .within(() => {
      cy.findAllByRole('columnheader')
        .then(columnHeaders => {
          const columnIndexMap = columnHeaders.toArray()
            .reduce<Record<string, number>>((acc, header, index) => {
              const headerName = header.textContent;
              acc[headerName] = index;

              return acc;
            }, {});

          return Object.entries(columnValues).reduce<Record<number, string | RowAssertion>>((acc, [key, value]) => {
            const headerIndex = columnIndexMap[key];
            expect(headerIndex).not.to.equal(undefined);
            acc[headerIndex] = value;

            return acc;
          }, {});
        }).as('columnValueMap');
    });

  const identifyingValue = columnValues[identifyingColumn];

  expect(identifyingValue).to.be.a('string');

  return getTableRowByColumnValue({
    tableName,
    column: identifyingColumn as string,
    value: identifyingValue as string,
  }).closest('tr')
    .then(row => {
      return cy.get<Record<number, string | RowAssertion>>('@columnValueMap')
        .then(columnValueMap => {
          const cells = row.find('td');

          Object.entries(columnValueMap).forEach(([index, value]) => {
            if (typeof value === 'function') {
              value(row, Number(index));
              return;
            }
            cy.wrap(cells.eq(Number(index))).should('have.text', value);
          });
        });
    });
}
