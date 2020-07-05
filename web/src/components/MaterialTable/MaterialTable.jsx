import React from 'react';
import {useSortBy, useTable} from 'react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
} from '@material-ui/core';
import {makeStyles} from '@material-ui/core/styles';

import {useEditable} from './useEditable';

const useStyles = makeStyles(() => ({
  editCell: {
    display: 'flex',
    justifyContent: 'center',
  },
}));

/**
 * Renders a table with data generated by react-table with custom hooks
 * @param {Object} props Component props
 * @constructor
 */
export default function MaterialTable(props) {
  const {
    columns,
    data,
    sortable = false,
    editable = false,
    onSaveRow,
  } = props;

  const classes = useStyles();

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    tableSize,
    prepareRow,
  } = useTable({
    columns,
    data,
    disableSortBy: !sortable,
    disableEditing: !editable,
    classes,
    onSaveRow,
  },
    useSortBy,
    useEditable);

  return (
    <Table
      size={tableSize}
      {...getTableProps()}
    >
      <TableHead>
        {headerGroups.map(headerGroup => (
          <TableRow {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map(col => (
              <TableCell
                {...col.getHeaderProps(col.getSortByToggleProps({ width: col.widthSuggestion }))}
              >
                {col.canSort ? (
                  <TableSortLabel
                    active={col.isSorted}
                    direction={col.isSortedDesc ? 'desc' : 'asc'}
                    hideSortIcon={!sortable}
                  >
                    {col.render('Header')}
                  </TableSortLabel>
                ) : col.render('Header')}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableHead>
      <TableBody {...getTableBodyProps()}>
        {rows.map(row => {
          prepareRow(row);
          return (
            <TableRow {...row.getRowProps()}>
              {row.cells.map(cell => (
                <TableCell
                  padding={cell.column.padding}
                  {...cell.getCellProps()}
                >
                  {cell.render('Cell')}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
