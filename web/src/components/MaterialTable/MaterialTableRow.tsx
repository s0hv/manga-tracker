import React from 'react';
import { TableCell, TableRow } from '@mui/material';
import {
  type Cell,
  type CellContext,
  type Renderable,
  type Row,
  type RowData,
  type TableFeatures,
  flexRender,
  Subscribe,
} from '@tanstack/react-table';

import { doIfRowFeatureExists } from '@/components/MaterialTable/utilities';

export interface MaterialTableRowProps<
  TFeatures extends TableFeatures,
  TData extends RowData
> {
  row: Row<TFeatures, TData>
}

interface MaterialTableCellProps<
  TFeatures extends TableFeatures,
  TData extends RowData
> {
  cell: Cell<TFeatures, TData>
  renderable: Renderable<CellContext<TFeatures, TData>>
}
const MaterialTableCell = <
  TFeatures extends TableFeatures,
  TData extends RowData
> ({ cell, renderable }: MaterialTableCellProps<TFeatures, TData>) => {
  return (
    <TableCell
      key={cell.id}
      padding={(cell as Cell<Pick<TableFeatures, 'columnMeta'>, TData>).column.columnDef.meta?.padding}
    >
      {flexRender(renderable, cell.getContext())}
    </TableCell>
  );
};

function renderCells<
  TFeatures extends TableFeatures,
  TData extends RowData
>(row: Row<TFeatures, TData>) {
  return (
    <>
      {row.getAllCells().map(
        cell => (
          <MaterialTableCell
            key={cell.id}
            cell={cell}
            renderable={cell.column.columnDef.cell}
          />
        )
      )}
    </>
  );
}

export const MaterialTableRow = <
  TFeatures extends TableFeatures,
  TData extends RowData
>({ row }: MaterialTableRowProps<TFeatures, TData>) => {
  return (
    <TableRow key={row.id}>
      {doIfRowFeatureExists(
        'rowEditingPlugin',
        row,
        row => (
          <Subscribe
            source={row.table.atoms.rowEditing}
            selector={rowEditing => rowEditing[row.id]}
          >
            {isRowEditing => isRowEditing
              ? (
                <>
                  {row.getAllCells().map(
                    cell => (
                      <MaterialTableCell
                        key={cell.id}
                        cell={cell}
                        renderable={cell.column.columnDef.enableEditing !== false
                          ? cell.column.columnDef.EditCell ?? cell.column.columnDef.cell
                          : cell.column.columnDef.cell}
                      />
                    )
                  )}
                </>
              )
              : renderCells(row)}
          </Subscribe>
        ),
        renderCells
      )}
    </TableRow>
  );
};
